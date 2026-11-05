import {
  EMPTY_TREES,
  TREE_SOURCE_LAYER,
  TREE_TILE_MAXZOOM,
  TREE_TILE_MINZOOM,
} from "./config";

const SPECIES_COLORS = [
  "#1b9e77",
  "#d95f02",
  "#7570b3",
  "#e7298a",
  "#66a61e",
  "#e6ab02",
  "#a6761d",
  "#1f78b4",
];

const PLANTING_COLORS = [
  { key: "calçada", label: "Calçada / Passeio", color: "#2b8cbe" },
  { key: "canteiro central", label: "Canteiro central", color: "#38a169" },
  { key: "praça", label: "Praça", color: "#e6ab02" },
  { key: "parque", label: "Parque", color: "#006d2c" },
  { key: "interna ao lote", label: "Interna ao lote", color: "#8c6bb1" },
];

const UNIDENTIFIED_SET = new Set([
  "",
  "sem identificação",
  "sem identificacao",
  "nao identificada",
  "não identificada",
  "desconhecida",
  "indeterminada",
  "n/a",
  "ni",
  "nid",
]);

export function normalizeSpeciesLabel(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || UNIDENTIFIED_SET.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

export function computeViewportSpeciesBreakdown(features = []) {
  const counts = new Map();
  let unidentified = 0;

  for (const f of features) {
    const raw = f?.properties?.NOME_POPULAR;
    const clean = normalizeSpeciesLabel(raw);
    if (!clean) {
      unidentified += 1;
      continue;
    }
    const key = clean.toUpperCase();
    const prev = counts.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      counts.set(key, {
        key,
        label: clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase(),
        rawValues: new Set([String(raw)]),
        count: 1,
      });
    }
    counts.get(key).rawValues.add(String(raw));
  }

  const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, 8).map((item, idx) => ({
    ...item,
    color: SPECIES_COLORS[idx % SPECIES_COLORS.length],
  }));

  const otherCount = sorted.slice(8).reduce((acc, item) => acc + item.count, 0);

  return {
    top,
    allSpecies: sorted,
    otherCount,
    unidentifiedCount: unidentified,
    total: features.length,
  };
}

export const TREE_LAYERS = ["arvores-layer", "arvores-local-layer"];

function eachTreeLayer(map, apply) {
  for (const id of TREE_LAYERS) {
    if (map.getLayer(id)) apply(id);
  }
}

function treeFilter(speciesFilter, hiddenIds) {
  const parts = [];
  if (speciesFilter && speciesFilter.trim() !== "") {
    parts.push([
      "==",
      ["downcase", ["coalesce", ["get", "NOME_POPULAR"], ""]],
      speciesFilter.trim().toLowerCase(),
    ]);
  }
  if (hiddenIds.length) {
    parts.push([
      "!",
      ["in", ["to-string", ["get", "ID"]], ["literal", hiddenIds]],
    ]);
  }
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : ["all", ...parts];
}

function setTreeColor(map, color) {
  eachTreeLayer(map, (id) => map.setPaintProperty(id, "circle-color", color));
}

export function updateTreeLayerStyle(
  map,
  { colorMode = "default", features = [], speciesFilter = "", hiddenIds = [] } = {}
) {
  if (!map?.getLayer("arvores-layer")) {
    return { legend: [] };
  }

  const filter = treeFilter(speciesFilter, hiddenIds);
  eachTreeLayer(map, (id) => map.setFilter(id, filter));

  if (colorMode === "species") {
    const breakdown = computeViewportSpeciesBreakdown(features);
    const matchExpr = [
      "match",
      ["upcase", ["coalesce", ["get", "NOME_POPULAR"], ""]],
    ];

    const legend = [];
    for (const item of breakdown.top) {
      matchExpr.push(item.key, item.color);
      legend.push({
        color: item.color,
        label: item.label,
        count: item.count,
      });
    }

    matchExpr.push(
      ["", "SEM IDENTIFICAÇÃO", "NÃO IDENTIFICADA", "DESCONHECIDA", "NID", "NI"],
      "#94a3b8",
      "#64748b"
    );

    if (breakdown.otherCount > 0) {
      legend.push({
        color: "#64748b",
        label: "Outras espécies",
        count: breakdown.otherCount,
      });
    }
    if (breakdown.unidentifiedCount > 0) {
      legend.push({
        color: "#94a3b8",
        label: "Sem identificação",
        count: breakdown.unidentifiedCount,
      });
    }

    setTreeColor(map, matchExpr);
    return { legend, breakdown };
  }

  if (colorMode === "planting") {
    const expr = [
      "case",
      [
        "in",
        "calçada",
        ["downcase", ["coalesce", ["get", "LOCAL_PLANTIO"], ""]],
      ],
      "#2b8cbe",
      [
        "in",
        "passeio",
        ["downcase", ["coalesce", ["get", "LOCAL_PLANTIO"], ""]],
      ],
      "#2b8cbe",
      [
        "in",
        "canteiro",
        ["downcase", ["coalesce", ["get", "LOCAL_PLANTIO"], ""]],
      ],
      "#38a169",
      [
        "in",
        "praça",
        ["downcase", ["coalesce", ["get", "LOCAL_PLANTIO"], ""]],
      ],
      "#e6ab02",
      [
        "in",
        "parque",
        ["downcase", ["coalesce", ["get", "LOCAL_PLANTIO"], ""]],
      ],
      "#006d2c",
      [
        "in",
        "lote",
        ["downcase", ["coalesce", ["get", "LOCAL_PLANTIO"], ""]],
      ],
      "#8c6bb1",
      "#94a3b8",
    ];

    setTreeColor(map, expr);
    return {
      legend: [
        ...PLANTING_COLORS.map((p) => ({ color: p.color, label: p.label })),
        { color: "#94a3b8", label: "Outros / Não informado" },
      ],
    };
  }

  // Default uniform green
  setTreeColor(map, "#38a169");
  return { legend: [] };
}

const TREE_PAINT = {
  "circle-radius": 5,
  "circle-color": "#38a169",
  "circle-stroke-width": 1,
  "circle-stroke-color": "#ffffff",
};

export function addTreeLayer(map, tileUrl = null) {
  if (!map.getSource("arvores")) {
    map.addSource(
      "arvores",
      tileUrl
        ? {
            type: "vector",
            tiles: [tileUrl],
            minzoom: TREE_TILE_MINZOOM,
            maxzoom: TREE_TILE_MAXZOOM,
          }
        : { type: "geojson", data: EMPTY_TREES }
    );
  }
  if (!map.getSource("arvores-local")) {
    map.addSource("arvores-local", { type: "geojson", data: EMPTY_TREES });
  }

  if (!map.getLayer("arvores-layer")) {
    map.addLayer({
      id: "arvores-layer",
      type: "circle",
      source: "arvores",
      ...(tileUrl ? { "source-layer": TREE_SOURCE_LAYER } : {}),
      minzoom: TREE_TILE_MINZOOM,
      paint: TREE_PAINT,
    });
  }
  if (!map.getLayer("arvores-local-layer")) {
    map.addLayer({
      id: "arvores-local-layer",
      type: "circle",
      source: "arvores-local",
      minzoom: TREE_TILE_MINZOOM,
      paint: TREE_PAINT,
    });
  }
}

export function replaceTreeTilesWithGeojson(map) {
  if (!map?.getLayer("arvores-layer")) return;
  const visibility = map.getLayoutProperty("arvores-layer", "visibility");
  const filter = map.getFilter("arvores-layer");
  const color = map.getPaintProperty("arvores-layer", "circle-color");
  map.removeLayer("arvores-layer");
  map.removeSource("arvores");
  addTreeLayer(map, null);
  if (visibility) map.setLayoutProperty("arvores-layer", "visibility", visibility);
  if (filter) map.setFilter("arvores-layer", filter);
  if (color) map.setPaintProperty("arvores-layer", "circle-color", color);
  raisePlantingLayers(map);
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

const MARKER_PLANTING = "marker-planting";
const MARKER_REPORT = "marker-report";
const MARKER_WIDTH = 32;
const MARKER_HEIGHT = 40;

export const CONTRIBUTION_POPUP_OFFSET = {
  bottom: [0, -MARKER_HEIGHT],
  "bottom-left": [0, -MARKER_HEIGHT],
  "bottom-right": [0, -MARKER_HEIGHT],
  top: [0, 4],
  "top-left": [0, 4],
  "top-right": [0, 4],
  left: [18, -20],
  right: [-18, -20],
  center: [0, -20],
};

function traceDialogueBubble(ctx) {
  const left = 1.5;
  const top = 1.5;
  const right = MARKER_WIDTH - 1.5;
  const bodyBottom = 26.5;
  const radius = 7;
  const tipX = MARKER_WIDTH / 2;
  const tipY = MARKER_HEIGHT - 1.5;
  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.arcTo(right, top, right, top + radius, radius);
  ctx.arcTo(right, bodyBottom, right - radius, bodyBottom, radius);
  ctx.lineTo(tipX + 4.5, bodyBottom);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(tipX - 4.5, bodyBottom);
  ctx.arcTo(left, bodyBottom, left, bodyBottom - radius, radius);
  ctx.arcTo(left, top, left + radius, top, radius);
  ctx.closePath();
}

export const REPORT_ICON =
  "M13.19708 1.3845c-0.51742-0.85915-1.44707-1.3845-2.44999-1.3845-1.00293 0-1.93258 0.52535-2.45001 1.3845l-7.88 12.87c-0.53799 0.88566-0.55676 1.99256-0.04911 2.89596 0.50764 0.9034 1.46286 1.46299 2.49911 1.46404l15.76001 0c1.03626-0.00105 1.99147-0.56064 2.49911-1.46404 0.50764-0.9034 0.48887-2.0103-0.04911-2.89596l-7.88001-12.87z m-3.45 5.5c0-0.55229 0.44771-1 1.00001-1 0.55228 0 1 0.44771 1 1l0 4.5c0 0.55228-0.44772 1-1 1-0.55229 0-1-0.44772-1.00001-1l0-4.5z m1.00001 8.75c-0.69036 0-1.25-0.55964-1.25001-1.25 0-0.69036 0.55964-1.25 1.25001-1.25 0.69036 0 1.25 0.55964 1.25 1.25 0 0.69036-0.55964 1.25-1.25 1.25";

export const PLANT_ICON =
  "M25.357 34.93c2.195 5.484 3.594 11.094 3.32 16.855-3.617 0.418-6.785 1.672-8.98 4.219-0.102 0.118-0.136 0.28-0.091 0.43 0.045 0.149 0.163 0.266 0.313 0.308 4.497 1.281 7.813 4.176 11.723 4.656l7.895-0.023c2.871-0.008 5.348 1.226 6.723 3.594 0.085 0.151 0.232 0.257 0.401 0.29 0.17 0.033 0.346-0.01 0.481-0.118l2.856-2.329c0.223-0.184 0.279-0.503 0.133-0.753-1.781-3.118-4.88-4.918-8.516-5.024-2.101-3.234-5.43-4.875-9.238-5.207-0.09-6.355 1.09-12.387 3.394-18.105 4.84-0.066 9.063-1.992 12.555-5.164 7.336-6.66 9.118-17.73 7.075-27.363-0.192-0.91-1.153-1.414-2.098-1.105-4.676 1.53-8.828 3.953-12.504 7.168-5.414 4.738-8.414 11.199-8.863 18.34-0.157 2.468 0.91 4.656 0.886 6.921l-2.222 8.797-2.809-7.808c1.094-2.274 1.121-4.637 0.672-7.2-1.324-7.57-7.77-13.288-15.402-14.18-1.164-0.136-2.184 0.473-2.328 1.579-1.375 10.484 3.707 20.738 14.62 21.227l0.004-0.005 0 0z";

export const HAND_ICON =
  "M75.45136 1.43244c-1.63701-1.594-4.371-2.008-6.12101-0.469l-6.027 5.301-7.493 6.086c0.2 3.684-2.476 7.25-6.285 7.266l-15.8 0.062c-0.845 0.004-1.356-1.14-1.212-1.64 0.164-0.579 0.676-1.126 1.453-1.13l15.23-0.015c2.461-0.004 4.004-2.238 3.946-4.426-0.059-2.137-1.52-4.16-3.88-4.2l-9.577-0.16c-2.434-0.038-4.543-1.464-6.633-2.60501-7.273-3.972-15.801-3.336-22.02 2.278l-9.965 10.109c-2.715 2.753 0.3 10.332 2.922 13.81601 2.117 2.812 5.398 2.828 8.094 0.832l4.941-3.657c2.61-1.5 5.543-1.343 8.418-0.629 5.207 1.297 10.242 2.54 15.59 3.00801 4.86 0.426 9.23-0.418 13.375-2.922 4.727-2.851 8.95-6.261 12.582-10.457l8.922-10.297c1.621-1.87 1.02001-4.707-0.45999-6.148l0-0.00301z";

const pathBounds = new Map();

function boundsForPath(d) {
  const cached = pathBounds.get(d);
  if (cached) return cached;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const box = path.getBBox();
  svg.remove();
  const bounds = { x: box.x, y: box.y, width: box.width, height: box.height };
  pathBounds.set(d, bounds);
  return bounds;
}

function fillPathInRect(ctx, d, x, y, width, height) {
  const box = boundsForPath(d);
  if (!box.width || !box.height) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / box.width, height / box.height);
  ctx.translate(-box.x, -box.y);
  ctx.fill(new Path2D(d));
  ctx.restore();
}

function drawReportIcon(ctx) {
  ctx.fillStyle = "#ffffff";
  fillPathInRect(ctx, REPORT_ICON, 8.8, 7.2, 14.4, 12.4);
}

function drawPlantingIcon(ctx) {
  ctx.fillStyle = "#ffffff";
  const scale = MARKER_WIDTH / 80;
  const offsetX = ((80 - 80 * 0.46) / 2) * scale;
  const offsetY = 13 * scale;
  fillPathInRect(
    ctx,
    PLANT_ICON,
    offsetX + 20.057884278116532 * 0.46 * scale,
    offsetY,
    47.531736737079385 * 0.46 * scale,
    65.26977740428612 * 0.46 * scale
  );
  fillPathInRect(
    ctx,
    HAND_ICON,
    offsetX,
    offsetY + 56.06365489959717 * 0.46 * scale,
    80 * 0.46 * scale,
    33.938529968261726 * 0.46 * scale
  );
}

function renderDialogueMarker(kind) {
  const pixelRatio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = MARKER_WIDTH * pixelRatio;
  canvas.height = MARKER_HEIGHT * pixelRatio;
  const ctx = canvas.getContext("2d");
  ctx.scale(pixelRatio, pixelRatio);

  ctx.shadowColor = "rgba(15, 23, 42, 0.28)";
  ctx.shadowBlur = 2.5;
  ctx.shadowOffsetY = 1;
  traceDialogueBubble(ctx);
  ctx.fillStyle = kind === "report" ? "#d67d00" : "#254f1f";
  ctx.fill();
  ctx.shadowColor = "transparent";

  if (kind === "report") drawReportIcon(ctx);
  else drawPlantingIcon(ctx);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function ensureDialogueMarkers(map) {
  if (!map.hasImage(MARKER_PLANTING)) {
    map.addImage(MARKER_PLANTING, renderDialogueMarker("planting"), { pixelRatio: 2 });
  }
  if (!map.hasImage(MARKER_REPORT)) {
    map.addImage(MARKER_REPORT, renderDialogueMarker("report"), { pixelRatio: 2 });
  }
}

function dialogueSymbolLayer(id, source, image) {
  return {
    id,
    type: "symbol",
    source,
    layout: {
      "icon-image": image,
      "icon-size": 1,
      "icon-anchor": "bottom",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-pitch-alignment": "viewport",
      "icon-rotation-alignment": "viewport",
    },
  };
}

export function addPlantingLayers(map) {
  ensureDialogueMarkers(map);
  if (!map.getSource("planting-suggestions")) {
    map.addSource("planting-suggestions", {
      type: "geojson",
      data: EMPTY_TREES,
    });
  }
  if (!map.getLayer("planting-suggestions-layer")) {
    map.addLayer(
      dialogueSymbolLayer("planting-suggestions-layer", "planting-suggestions", MARKER_PLANTING)
    );
  }

  if (!map.getSource("planting-draft")) {
    map.addSource("planting-draft", {
      type: "geojson",
      data: EMPTY_TREES,
    });
  }
  if (!map.getLayer("planting-draft-layer")) {
    map.addLayer(dialogueSymbolLayer("planting-draft-layer", "planting-draft", MARKER_PLANTING));
  }

  raisePlantingLayers(map);
}

export function raisePlantingLayers(map) {
  if (!map) return;
  eachTreeLayer(map, (id) => map.moveLayer(id));
  if (map.getLayer("planting-suggestions-layer")) {
    map.moveLayer("planting-suggestions-layer");
  }
  if (map.getLayer("problem-reports-layer")) {
    map.moveLayer("problem-reports-layer");
  }
  if (map.getLayer("planting-draft-layer")) {
    map.moveLayer("planting-draft-layer");
  }
  if (map.getLayer("problem-draft-layer")) {
    map.moveLayer("problem-draft-layer");
  }
  if (map.getLayer("pending-tree-layer")) {
    map.moveLayer("pending-tree-layer");
  }
}

export function setPlantingSuggestions(map, geojson) {
  map?.getSource("planting-suggestions")?.setData(geojson ?? EMPTY_TREES);
}

export function setPlantingDraft(map, coords) {
  const source = map?.getSource("planting-draft");
  if (!source || !coords) return;
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

export function clearPlantingDraft(map) {
  map?.getSource("planting-draft")?.setData(EMPTY_TREES);
}

export function addProblemLayers(map) {
  ensureDialogueMarkers(map);
  if (!map.getSource("problem-reports")) {
    map.addSource("problem-reports", {
      type: "geojson",
      data: EMPTY_TREES,
    });
  }
  if (!map.getLayer("problem-reports-layer")) {
    map.addLayer(
      dialogueSymbolLayer("problem-reports-layer", "problem-reports", MARKER_REPORT)
    );
  }

  if (!map.getSource("problem-draft")) {
    map.addSource("problem-draft", {
      type: "geojson",
      data: EMPTY_TREES,
    });
  }
  if (!map.getLayer("problem-draft-layer")) {
    map.addLayer(dialogueSymbolLayer("problem-draft-layer", "problem-draft", MARKER_REPORT));
  }

  raisePlantingLayers(map);
}

export function setProblemReports(map, geojson) {
  map?.getSource("problem-reports")?.setData(geojson ?? EMPTY_TREES);
}

export function setProblemDraft(map, coords) {
  const source = map?.getSource("problem-draft");
  if (!source || !coords) return;
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

export function clearProblemDraft(map) {
  map?.getSource("problem-draft")?.setData(EMPTY_TREES);
}

export function setTreeLayerVisible(map, visible) {
  if (!map?.getLayer("arvores-layer")) return null;
  eachTreeLayer(map, (id) =>
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none")
  );
  return visible;
}

export function setProblemReportsVisible(map, visible) {
  if (!map?.getLayer("problem-reports-layer")) return null;
  map.setLayoutProperty(
    "problem-reports-layer",
    "visibility",
    visible ? "visible" : "none"
  );
  return visible;
}

export function setPlantingSuggestionsVisible(map, visible) {
  if (!map?.getLayer("planting-suggestions-layer")) return null;
  map.setLayoutProperty(
    "planting-suggestions-layer",
    "visibility",
    visible ? "visible" : "none"
  );
  return visible;
}
