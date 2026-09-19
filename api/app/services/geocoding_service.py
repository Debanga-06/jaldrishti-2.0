"""OpenStreetMap Nominatim Geocoding & Location Resolution Service.

Supports location-agnostic forward address search and reverse GPS geocoding
for any Indian or global municipality/city.
"""

from typing import List, Dict, Any, Optional
import httpx


class GeocodingService:
    NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
    NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"

    # Pre-indexed offline location database for instant fallback
    OFFLINE_LOCATIONS: List[Dict[str, Any]] = [
      {
        "display_name": "Jessore Road, Champadali More, Barasat, Ward 4, West Bengal",
        "locality": "Barasat Ward 4",
        "address": "Champadali More, Jessore Road, Barasat",
        "lat": 22.7214,
        "lon": 88.4821,
        "district": "North 24 Parganas",
        "state": "West Bengal",
        "country": "India"
      },
      {
        "display_name": "Sector V, Salt Lake Electronics Complex, Bidhannagar, Kolkata, West Bengal",
        "locality": "Salt Lake Sector V",
        "address": "EP Block, Sector V, Salt Lake",
        "lat": 22.5726,
        "lon": 88.4331,
        "district": "Kolkata",
        "state": "West Bengal",
        "country": "India"
      },
      {
        "display_name": "Howrah Station Road, Howrah Municipality, West Bengal",
        "locality": "Howrah Junction Area",
        "address": "Howrah Station Approach Road, Howrah",
        "lat": 22.5835,
        "lon": 88.3426,
        "district": "Howrah",
        "state": "West Bengal",
        "country": "India"
      },
      {
        "display_name": "Hill Cart Road, Siliguri Municipality, Darjeeling, West Bengal",
        "locality": "Siliguri Town Center",
        "address": "Hill Cart Road, Siliguri",
        "lat": 26.7271,
        "lon": 88.4315,
        "district": "Darjeeling",
        "state": "West Bengal",
        "country": "India"
      },
      {
        "display_name": "Janpath Road, Master Canteen Square, Bhubaneswar, Odisha",
        "locality": "Bhubaneswar Central",
        "address": "Janpath Road, Master Canteen, Bhubaneswar",
        "lat": 20.2706,
        "lon": 85.8334,
        "district": "Khurda",
        "state": "Odisha",
        "country": "India"
      },
      {
        "display_name": "GS Road, Dispur, Guwahati, Assam",
        "locality": "Guwahati Dispur Corridor",
        "address": "GS Road, Ganeshguri, Guwahati",
        "lat": 26.1445,
        "lon": 91.7898,
        "district": "Kamrup Metropolitan",
        "state": "Assam",
        "country": "India"
      },
      {
        "display_name": "Connaught Place, New Delhi, Delhi",
        "locality": "CP Inner Circle",
        "address": "Connaught Place, New Delhi",
        "lat": 28.6315,
        "lon": 77.2167,
        "district": "New Delhi",
        "state": "Delhi",
        "country": "India"
      },
      {
        "display_name": "Bandra Kurla Complex (BKC), Mumbai, Maharashtra",
        "locality": "Bandra Kurla Complex",
        "address": "BKC Main Avenue, Bandra East, Mumbai",
        "lat": 19.0657,
        "lon": 72.8687,
        "district": "Mumbai Suburban",
        "state": "Maharashtra",
        "country": "India"
      },
      {
        "display_name": "MG Road, Indiranagar, Bengaluru, Karnataka",
        "locality": "Indiranagar MG Road",
        "address": "100 Feet Road, Indiranagar, Bengaluru",
        "lat": 12.9716,
        "lon": 77.5946,
        "district": "Bengaluru Urban",
        "state": "Karnataka",
        "country": "India"
      }
    ]

_HTTP_CLIENT: Optional[httpx.AsyncClient] = None

def get_geocoding_client() -> httpx.AsyncClient:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None or _HTTP_CLIENT.is_closed:
        _HTTP_CLIENT = httpx.AsyncClient(
            timeout=httpx.Timeout(2.5, connect=1.5),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        )
    return _HTTP_CLIENT


class GeocodingService:
    NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
    NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
    PHOTON_SEARCH_URL = "https://photon.komoot.io/api/"

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
        except Exception as e:
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

GeocodingService.warm_cache()
