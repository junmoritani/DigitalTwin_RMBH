export const MAP_CENTER = [-43.93483, -19.92999];
export const MAP_ZOOM = 16.2;
export const MAP_STYLE = "mapbox://styles/mapbox/standard";
export const MAP_BASEMAP_CONFIG = {
  theme: "faded",
  lightPreset: "day",
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  show3dObjects: false,
};

// Below this zoom individual trees give way to the district choropleth.
// Downtown z14 tiles hold ~20k trees (~600 KB), z15 tiles at most ~5k.
export const DENSITY_MAX_ZOOM = 15;
export const TREE_TILE_MINZOOM = DENSITY_MAX_ZOOM;
// Tiles past this zoom are overzoomed from z16 instead of requested again.
export const TREE_TILE_MAXZOOM = 16;
export const TREE_SOURCE_LAYER = "trees";

export const EMPTY_TREES = {
  type: "FeatureCollection",
  features: [],
};
