import { useEffect, useRef, useState } from "react";
import {
  DENSITY_MAX_ZOOM,
  EMPTY_TREES,
  TREE_SOURCE_LAYER,
  TREE_TILE_MAXZOOM,
  TREE_TILE_MINZOOM,
} from "./config";
import { replaceTreeTilesWithGeojson } from "./layers";
import { fetchTreesInView, treeTilesAvailable, treeTilesUrl } from "../lib/treesApi";

function boxFromBounds(bounds) {
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

function boxContains(outer, inner) {
  return (
    outer.west <= inner.west &&
    outer.south <= inner.south &&
    outer.east >= inner.east &&
    outer.north >= inner.north
  );
}

function featureInBox(feature, box) {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return false;
  const [lng, lat] = coords;
  return lng >= box.west && lng <= box.east && lat >= box.south && lat <= box.north;
}

function collection(features) {
  return { type: "FeatureCollection", features };
}

export function useViewportTrees(mapRef) {
  const [visibleTrees, setVisibleTrees] = useState(EMPTY_TREES);
  const [densityMode, setDensityMode] = useState(false);
  const [hiddenIds, setHiddenIds] = useState([]);
  const modeRef = useRef(treeTilesUrl ? "tiles" : "geojson");
  const idlePendingRef = useRef(false);
  const refreshTimerRef = useRef(null);
  const refreshAbortRef = useRef(null);
  const addedTreesRef = useRef([]);
  const hiddenIdsRef = useRef(new Set());
  const featureCacheRef = useRef(new Map());
  const loadedBoxesRef = useRef([]);

  useEffect(() => {
    hiddenIdsRef.current = new Set(hiddenIds);
  }, [hiddenIds]);

  const publishLocalTrees = (map) => {
    map?.getSource("arvores-local")?.setData(collection(addedTreesRef.current));
  };

  const collectVisible = (map) => {
    if (map.getZoom() < DENSITY_MAX_ZOOM) {
      setVisibleTrees(EMPTY_TREES);
      return;
    }
    const box = boxFromBounds(map.getBounds());
    const seen = new Set();
    const features = [];
    const take = (feature) => {
      const id = String(feature.properties?.ID ?? feature.id);
      if (seen.has(id) || hiddenIdsRef.current.has(id)) return;
      if (!featureInBox(feature, box)) return;
      seen.add(id);
      features.push({
        type: "Feature",
        geometry: feature.geometry,
        properties: feature.properties,
      });
    };

    if (modeRef.current === "tiles") {
      for (const feature of map.querySourceFeatures("arvores", {
        sourceLayer: TREE_SOURCE_LAYER,
      })) {
        take(feature);
      }
    } else {
      for (const feature of featureCacheRef.current.values()) take(feature);
    }
    for (const feature of addedTreesRef.current) take(feature);

    setVisibleTrees(collection(features));
  };

  const collectWhenIdle = (map) => {
    collectVisible(map);
    if (idlePendingRef.current) return;
    idlePendingRef.current = true;
    map.once("idle", () => {
      idlePendingRef.current = false;
      collectVisible(map);
    });
  };

  const loadGeojsonInView = async (map) => {
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    const box = boxFromBounds(map.getBounds());

    try {
      if (!loadedBoxesRef.current.some((loaded) => boxContains(loaded, box))) {
        const geojson = await fetchTreesInView(map.getBounds(), controller.signal);
        if (controller.signal.aborted) return;
        for (const feature of geojson.features ?? []) {
          const id = feature.properties?.ID;
          if (id != null) featureCacheRef.current.set(String(id), feature);
        }
        if (!geojson.truncated) {
          loadedBoxesRef.current = loadedBoxesRef.current.filter(
            (loaded) => !boxContains(box, loaded)
          );
          loadedBoxesRef.current.push(box);
        }
        map
          .getSource("arvores")
          ?.setData(collection([...featureCacheRef.current.values()]));
      }
      collectVisible(map);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Failed to load trees for the current view:", error);
    }
  };

  const refreshTreesInView = (map) => {
    window.clearTimeout(refreshTimerRef.current);
    const dense = map.getZoom() < DENSITY_MAX_ZOOM;
    setDensityMode(dense);
    if (dense) {
      refreshAbortRef.current?.abort();
      setVisibleTrees(EMPTY_TREES);
      return;
    }
    if (modeRef.current === "tiles") {
      collectWhenIdle(map);
      return;
    }
    refreshTimerRef.current = window.setTimeout(() => {
      loadGeojsonInView(map);
    }, 200);
  };

  const fallBackToGeojson = (map, reason) => {
    if (modeRef.current !== "tiles") return;
    console.warn("Tree vector tiles unavailable, falling back to GeoJSON:", reason);
    modeRef.current = "geojson";
    replaceTreeTilesWithGeojson(map);
    refreshTreesInView(map);
  };

  const verifyTileSource = async (map) => {
    if (modeRef.current !== "tiles") return;
    const center = map.getCenter();
    const zoom = Math.max(
      TREE_TILE_MINZOOM,
      Math.min(Math.floor(map.getZoom()), TREE_TILE_MAXZOOM)
    );
    const available = await treeTilesAvailable(center.lng, center.lat, zoom);
    if (!available) fallBackToGeojson(map, "tile endpoint did not respond");
  };

  const handleMapError = (map, event) => {
    if (event?.sourceId !== "arvores") return;
    const status = event.error?.status;
    if (status && (status < 400 || status >= 500)) return;
    fallBackToGeojson(map, event.error?.message || status);
  };

  const stop = () => {
    window.clearTimeout(refreshTimerRef.current);
    refreshAbortRef.current?.abort();
  };

  const addLocalTree = (feature) => {
    addedTreesRef.current = [...addedTreesRef.current, feature];
    publishLocalTrees(mapRef.current);
    setVisibleTrees((current) => collection([...current.features, feature]));
  };

  const removeLocalTree = (id) => {
    const key = String(id);
    addedTreesRef.current = addedTreesRef.current.filter(
      (feature) => String(feature.properties?.ID) !== key
    );
    publishLocalTrees(mapRef.current);
    hiddenIdsRef.current.add(key);
    setHiddenIds((current) => (current.includes(key) ? current : [...current, key]));
    setVisibleTrees((current) =>
      collection(
        current.features.filter(
          (feature) => String(feature.properties?.ID) !== key
        )
      )
    );
  };

  return {
    visibleTrees,
    densityMode,
    hiddenIds,
    refreshTreesInView,
    verifyTileSource,
    handleMapError,
    addLocalTree,
    removeLocalTree,
    stop,
  };
}
