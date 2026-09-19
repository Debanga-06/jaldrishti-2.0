"""OpenStreetMap Nominatim & Photon Geocoding & Location Resolution Service.

Supports location-agnostic forward address search and reverse GPS geocoding
for any Indian or global municipality/city.
"""

from typing import List, Dict, Any, Optional
import httpx
import asyncio


_HTTP_CLIENT: Optional[httpx.AsyncClient] = None

def get_geocoding_client() -> httpx.AsyncClient:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None or _HTTP_CLIENT.is_closed:
        _HTTP_CLIENT = httpx.AsyncClient(
            timeout=httpx.Timeout(2.5, connect=1.5),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        )
    return _HTTP_CLIENT


class GeocodingService:
    NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
    NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
    PHOTON_SEARCH_URL = "https://photon.komoot.io/api/"

    @classmethod
    async def fetch_photon(cls, client: httpx.AsyncClient, cleaned: str, headers: dict) -> List[Dict[str, Any]]:
        for attempt in range(2):
            try:
                res = await client.get(
                    cls.PHOTON_SEARCH_URL,
                    params={"q": cleaned, "limit": 10},
                    headers=headers,
                    timeout=2.2
                )
                if res.status_code == 200:
                    data = res.json()
                    features = data.get("features", [])
                    if features:
                        parsed = []
                        for feat in features:
                            p = feat.get("properties", {})
                            coords = feat.get("geometry", {}).get("coordinates", [0.0, 0.0])
                            lon, lat = float(coords[0]), float(coords[1])
                            name = p.get("name") or p.get("street") or cleaned
                            city = p.get("city") or p.get("town") or p.get("village") or p.get("hamlet") or p.get("suburb") or p.get("district") or ""
                            state = p.get("state", "")
                            country = p.get("country", "India")
                            
                            is_india = country.lower() == "india" or (68.0 <= lon <= 98.0 and 6.0 <= lat <= 38.0)
                            
                            parts = [pt for pt in [name, city, p.get("district") or p.get("county"), state, country] if pt]
                            display_name = ", ".join(parts)
                            locality = f"{name}, {city}" if city else name

                            category = p.get("osm_key") or p.get("type") or p.get("category") or "place"
                            place_type = p.get("osm_value") or p.get("type") or "location"

                            parsed.append({
                                "name": name,
                                "display_name": display_name,
                                "locality": locality,
                                "address": name,
                                "lat": lat,
                                "lon": lon,
                                "type": place_type,
                                "category": category,
                                "district": p.get("district") or p.get("county") or city or "District",
                                "state": state or "State",
                                "country": country,
                                "source": "PHOTON_OSM",
                                "is_india": is_india,
                            })
                        
                        parsed.sort(key=lambda x: not x["is_india"])
                        return parsed
                elif attempt == 0:
                    await asyncio.sleep(0.3)
            except Exception:
                if attempt == 0:
                    await asyncio.sleep(0.3)
        return []

    @classmethod
    async def fetch_nominatim(cls, client: httpx.AsyncClient, cleaned: str, headers: dict) -> List[Dict[str, Any]]:
        for attempt in range(2):
            try:
                params = {
                    "q": cleaned,
                    "format": "json",
                    "addressdetails": 1,
                    "limit": 8,
                    "countrycodes": "in"
                }
                res = await client.get(cls.NOMINATIM_SEARCH_URL, params=params, headers=headers, timeout=2.5)
                if res.status_code == 200:
                    results = res.json()
                    parsed = []
                    for item in results:
                        addr = item.get("address", {})
                        locality = (
                            addr.get("village")
                            or addr.get("hamlet")
                            or addr.get("suburb")
                            or addr.get("neighbourhood")
                            or addr.get("town")
                            or addr.get("city_district")
                            or addr.get("city")
                            or addr.get("county")
                            or addr.get("state_district")
                            or "Local Area"
                        )
                        state = addr.get("state", "State")
                        district = addr.get("state_district") or addr.get("county") or "District"
                        parsed.append({
                            "display_name": item.get("display_name"),
                            "locality": f"{locality}, {state}" if state != "State" else locality,
                            "address": item.get("display_name", "").split(",")[0],
                            "lat": float(item.get("lat")),
                            "lon": float(item.get("lon")),
                            "district": district,
                            "state": state,
                            "country": addr.get("country", "India"),
                            "source": "NOMINATIM_OSM"
                        })
                    return parsed
                elif attempt == 0:
                    await asyncio.sleep(0.3)
            except Exception:
                if attempt == 0:
                    await asyncio.sleep(0.3)
        return []

    GEOCODE_CACHE: Dict[str, List[Dict[str, Any]]] = {}

    @classmethod
    def warm_cache(cls):
        pass

    @classmethod
    async def search_address(cls, query: str) -> List[Dict[str, Any]]:
        """Search address suggestions using live Photon (primary) & Nominatim (fallback) OpenStreetMap APIs."""
        if not query or len(query.strip()) < 2:
            return []

        cleaned = query.strip()
        cache_key = cleaned.lower()
        if cache_key in cls.GEOCODE_CACHE:
            return cls.GEOCODE_CACHE[cache_key]

        headers_photon = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        headers_nominatim = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"}
        client = get_geocoding_client()

        # Step 1: Try Photon primary search (returns full live list from OSM)
        try:
            photon_results = await cls.fetch_photon(client, cleaned, headers_photon)
            if photon_results:
                cls.GEOCODE_CACHE[cache_key] = photon_results
                return photon_results
        except Exception:
            pass

        # Step 2: Fallback to Nominatim ONLY if Photon returns empty or fails
        try:
            nominatim_results = await cls.fetch_nominatim(client, cleaned, headers_nominatim)
            if nominatim_results:
                cls.GEOCODE_CACHE[cache_key] = nominatim_results
                return nominatim_results
        except Exception:
            pass

        return []

    @classmethod
    async def reverse_geocode(cls, lat: float, lon: float) -> Dict[str, Any]:
        """Reverse geocode coordinates into a structured location address."""
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                params = {
                    "lat": lat,
                    "lon": lon,
                    "format": "json",
                    "addressdetails": 1
                }
                headers = {"User-Agent": "JALDRISHTI-Urban-Flood-Digital-Twin/2.0"}
                response = await client.get(cls.NOMINATIM_REVERSE_URL, params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    addr = data.get("address", {})
                    road = addr.get("road") or addr.get("pedestrian") or "Local Corridor"
                    locality = addr.get("suburb") or addr.get("neighbourhood") or addr.get("town") or addr.get("city") or "Municipal Ward"
                    return {
                        "display_name": data.get("display_name"),
                        "road": road,
                        "locality": locality,
                        "address": f"{road}, {locality}",
                        "lat": lat,
                        "lon": lon,
                        "district": addr.get("state_district") or addr.get("county") or "District",
                        "state": addr.get("state", "State"),
                        "country": addr.get("country", "India"),
                        "location_source": "GPS"
                    }
        except Exception:
            pass

        return {
            "display_name": f"Current GPS Location ({lat:.4f}°N, {lon:.4f}°E)",
            "road": "GPS Location Road",
            "locality": "Municipal Zone",
            "address": f"Coordinates {lat:.4f}°N, {lon:.4f}°E",
            "lat": lat,
            "lon": lon,
            "district": "District Zone",
            "state": "State",
            "country": "India",
            "location_source": "GPS"
        }

