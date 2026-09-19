/**
 * JALDRISHTI Map, Geocoding & Routing Provider Abstraction
 * Rich, Detailed, Colorful Navigation Map Configuration (Zero API Key Required)
 */

import * as maplibregl from 'maplibre-gl';

export interface MapTileProvider {
  name: string;
  type: 'raster' | 'vector';
  tiles: string[];
  referenceTiles?: string[];
  attribution: string;
  tileSize: number;
  maxZoom: number;
  requiresApiKey: boolean;
}

export interface MapProviderConfig {
  activeProvider: string;
  primary: MapTileProvider;
  fallback: MapTileProvider;
  geocoderUrl: string;
  geocoderRequiresApiKey: boolean;
  routerUrl: string;
}

export const MAP_PROVIDER_CONFIG: MapProviderConfig = {
  activeProvider: 'osm-standard-street-nav',

  // Primary: CartoDB Voyager / OpenStreetMap Standard High-Detail Navigation Map
  primary: {
    name: 'OpenStreetMap High-Detail Navigation Map',
    type: 'raster',
    tiles: [
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    attribution: '© OpenStreetMap contributors, © CARTO',
    tileSize: 256,
    maxZoom: 19,
    requiresApiKey: false,
  },

  // Fallback: Esri World Street Navigation Map
  fallback: {
    name: 'Esri World Street Navigation Map',
    type: 'raster',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: '© OpenStreetMap contributors, © Esri',
    tileSize: 256,
    maxZoom: 19,
    requiresApiKey: false,
  },

  // Geocoding: OpenStreetMap Nominatim API (Zero Key)
  geocoderUrl: 'https://nominatim.openstreetmap.org/search',
  geocoderRequiresApiKey: false,

  // Routing Engine: JALDRISHTI FastAPI Backend API
  routerUrl: '/api/v1/navigation/routes/evaluate',
};

/**
 * Returns rich colorful MapLibre style specification with vibrant landuse,
 * water bodies, road network hierarchy, and crisp POI markers.
 * Overscales raster tiles seamlessly up to zoom 24 so map never turns black.
 */
export function getMapLibreStyle(isLightMode: boolean = true): maplibregl.StyleSpecification {
  const provider = MAP_PROVIDER_CONFIG.primary;

  return {
    version: 8,
    sources: {
      'jaldrishti-street-nav-source': {
        type: 'raster',
        tiles: provider.tiles,
        tileSize: provider.tileSize,
        attribution: provider.attribution,
        minzoom: 0,
        maxzoom: 19, // Native OSM raster tiles end at z=19; MapLibre overscales up to z=24
      },
    },
    layers: [
      {
        id: 'jaldrishti-background-layer',
        type: 'background',
        paint: {
          'background-color': '#f1f5f9', // Crisp slate-100 background guarantees non-black canvas
        },
      },
      {
        id: 'jaldrishti-street-nav-layer',
        type: 'raster',
        source: 'jaldrishti-street-nav-source',
        minzoom: 0,
        maxzoom: 24, // Layer stays 100% visible at all high zoom levels up to 24
      },
    ],
  };
}
