import { EMPTY_TREES } from "./config";

export function addTreeLayer(map) {
  if (!map.getSource("arvores")) {
    map.addSource("arvores", { type: "geojson", data: EMPTY_TREES });
  }

  if (!map.getLayer("arvores-layer")) {
    map.addLayer({
      id: "arvores-layer",
      type: "circle",
      source: "arvores",
      paint: {
        "circle-radius": 5,
        "circle-color": "#38a169",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
      },
    });
  }
}

export function addPendingTreeLayer(map) {
  map.addSource("pending-tree", {
    type: "geojson",
    data: EMPTY_TREES,
  });

  map.addLayer({
    id: "pending-tree-layer",
    type: "circle",
    source: "pending-tree",
    paint: {
      "circle-radius": 6,
      "circle-color": "#ff7f00",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff",
    },
  });
}

export function setPendingTree(map, coords) {
  const source = map?.getSource("pending-tree");
  if (!source) return;

  source.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: coords },
        properties: {},
      },
    ],
  });
}

export function clearPendingTree(map) {
  map?.getSource("pending-tree")?.setData(EMPTY_TREES);
}
