import { useEffect, useRef, useState } from "react";
import { fetchTreesInView } from "../lib/treesApi";

function mergeTrees(geojson, addedTrees, deletedIds) {
  const fromApi = (geojson.features ?? []).filter(
    (feature) => !deletedIds.has(String(feature.properties?.ID))
  );
  const apiIds = new Set(fromApi.map((feature) => String(feature.properties?.ID)));
  const added = addedTrees.filter(
    (feature) => !apiIds.has(String(feature.properties?.ID))
  );

  return {
    type: "FeatureCollection",
    features: [...fromApi, ...added],
  };
}

export function useViewportTrees(mapRef) {
  const [treesData, setTreesData] = useState(null);
  const refreshTimerRef = useRef(null);
  const refreshAbortRef = useRef(null);
  const addedTreesRef = useRef([]);
  const deletedIdsRef = useRef(new Set());

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !treesData) return;
    map.getSource("arvores")?.setData(treesData);
  }, [mapRef, treesData]);

  const loadTreesInView = async (map) => {
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;

    try {
      const geojson = await fetchTreesInView(map.getBounds(), controller.signal);
      if (controller.signal.aborted) return;
      setTreesData(
        mergeTrees(geojson, addedTreesRef.current, deletedIdsRef.current)
      );
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Failed to load trees for the current view:", error);
    }
  };

  const refreshTreesInView = (map) => {
    window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      loadTreesInView(map);
    }, 200);
  };

  const stop = () => {
    window.clearTimeout(refreshTimerRef.current);
    refreshAbortRef.current?.abort();
  };

  const addLocalTree = (feature) => {
    addedTreesRef.current = [...addedTreesRef.current, feature];
    setTreesData((current) => ({
      type: "FeatureCollection",
      features: [...(current?.features ?? []), feature],
    }));
  };

  const removeLocalTree = (id) => {
    const key = String(id);
    deletedIdsRef.current.add(key);
    addedTreesRef.current = addedTreesRef.current.filter(
      (feature) => String(feature.properties?.ID) !== key
    );
    setTreesData((current) => {
      if (!current) return current;
      return {
        ...current,
        features: current.features.filter(
          (feature) => String(feature.properties?.ID) !== key
        ),
      };
    });
  };

  return {
    treesData,
    refreshTreesInView,
    addLocalTree,
    removeLocalTree,
    stop,
  };
}
