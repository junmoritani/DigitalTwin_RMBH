import { raisePlantingLayers } from "./layers";

const SOURCE_ID = "bairro-density";
export const DENSITY_FILL_LAYER = "bairro-density-fill";
export const DENSITY_LINE_LAYER = "bairro-density-line";

export const BAIRRO_METRICS = {
  DENSITY: {
    id: "TREES_PER_KM2",
    title: "Árvores por km²",
    subtitle: "Sem parques, lagos, clubes, campi e grandes equipamentos",
    palette: ["#edf7ed", "#c7e9c0", "#7bc67e", "#31a354", "#006d2c", "#00441b"],
    unitSuffix: "",
  },
  SPECIES_COUNT: {
    id: "SPECIES_COUNT",
    title: "Riqueza de espécies por bairro",
    subtitle: "Número de espécies arbóreas distintas identificadas",
    palette: ["#f0f9e8", "#ccebc5", "#a8ddb5", "#7bccc4", "#2b8cbe", "#08589e"],
    unitSuffix: " esp.",
  },
  MONOCULTURE: {
    id: "TOP_SPECIES_SHARE",
    title: "Concentração da espécie dominante (%)",
    subtitle: "Alerta quando >20% das árvores são de uma única espécie",
    palette: ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#e34a33", "#b30000"],
    unitSuffix: "%",
  },
};

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});
const decimalFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatTrees(value) {
  return numberFormat.format(Number(value) || 0);
}

export function formatPct(value) {
  return decimalFormat.format(Number(value) || 0);
}

export function formatArea(value) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function increasingStops(values) {
  const stops = [];
  for (const value of values) {
    const rounded = Math.max(1, Math.round(value));
    if (stops.length && rounded <= stops[stops.length - 1]) continue;
    stops.push(rounded);
  }
  return stops;
}

export function metricScale(features, metricKey = "DENSITY") {
  const metric = BAIRRO_METRICS[metricKey] || BAIRRO_METRICS.DENSITY;
  const prop = metric.id;
  const palette = metric.palette;

  if (metricKey === "MONOCULTURE") {
    const fixedStops = [10, 15, 22, 30, 40];
    const expression = ["step", ["coalesce", ["get", prop], 0], palette[0]];
    fixedStops.forEach((stop, index) => {
      expression.push(stop, palette[Math.min(index + 1, palette.length - 1)]);
    });

    const legend = [
      { color: palette[0], label: "menos de 10% (diverso)" },
      { color: palette[1], label: "10% – 15%" },
      { color: palette[2], label: "15% – 22% (atenção)" },
      { color: palette[3], label: "22% – 30%" },
      { color: palette[4], label: "30% – 40%" },
      { color: palette[5], label: "40% ou mais (monocultura)" },
    ];

    return { expression, legend, metric };
  }

  const values = features
    .map((feature) => Number(feature.properties?.[prop]) || 0)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  const at = (fraction) => {
    if (!values.length) return null;
    const index = Math.min(
      values.length - 1,
      Math.round(fraction * (values.length - 1))
    );
    return values[index];
  };

  const stops = increasingStops(
    [0.2, 0.4, 0.6, 0.8].map(at).filter((value) => value != null)
  );

  const expression = ["step", ["coalesce", ["get", prop], 0], palette[0]];
  stops.forEach((stop, index) => {
    expression.push(stop, palette[Math.min(index + 1, palette.length - 1)]);
  });

  const suffix = metric.unitSuffix;
  const legend = [
    {
      color: palette[0],
      label: stops.length ? `menos de ${formatTrees(stops[0])}${suffix}` : "0",
    },
  ];
  stops.forEach((stop, index) => {
    const next = stops[index + 1];
    legend.push({
      color: palette[Math.min(index + 1, palette.length - 1)],
      label: next
        ? `${formatTrees(stop)} – ${formatTrees(next)}${suffix}`
        : `${formatTrees(stop)}${suffix} ou mais`,
    });
  });

  return { expression, legend, metric };
}

export function densityScale(features) {
  return metricScale(features, "DENSITY");
}

function setLayerVisibility(map, visible) {
  const visibility = visible ? "visible" : "none";
  for (const layerId of [DENSITY_FILL_LAYER, DENSITY_LINE_LAYER]) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", visibility);
    }
  }
}

export async function addBairroDensityLayer(map, initialMetric = "DENSITY") {
  const response = await fetch("/data/bairro_tree_density.geojson");
  if (!response.ok) {
    throw new Error(`Bairro density data responded with ${response.status}`);
  }
  const geojson = await response.json();
  const { expression, legend, metric } = metricScale(
    geojson.features ?? [],
    initialMetric
  );

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
  }

  if (!map.getLayer(DENSITY_FILL_LAYER)) {
    map.addLayer({
      id: DENSITY_FILL_LAYER,
      type: "fill",
      source: SOURCE_ID,
      slot: "middle",
      layout: { visibility: "none" },
      paint: {
        "fill-color": expression,
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.92,
          0.78,
        ],
      },
    });
  }

  if (!map.getLayer(DENSITY_LINE_LAYER)) {
    map.addLayer({
      id: DENSITY_LINE_LAYER,
      type: "line",
      source: SOURCE_ID,
      slot: "middle",
      layout: { visibility: "none" },
      paint: {
        "line-color": "#ffffff",
        "line-width": 1.2,
        "line-opacity": 0.9,
      },
    });
  }

  raisePlantingLayers(map);

  return { geojson, legend, metric };
}

export function setBairroMetric(map, features, metricKey = "DENSITY") {
  if (!map || !features?.length) return null;
  const { expression, legend, metric } = metricScale(features, metricKey);
  if (map.getLayer(DENSITY_FILL_LAYER)) {
    map.setPaintProperty(DENSITY_FILL_LAYER, "fill-color", expression);
  }
  return { legend, metric };
}

export function setBairroDensityVisible(map, visible) {
  if (!map) return;
  setLayerVisibility(map, visible);
}

export function setHoveredBairro(map, nextId, previousId) {
  if (!map?.getSource(SOURCE_ID)) return;
  if (previousId != null && previousId !== nextId) {
    map.setFeatureState(
      { source: SOURCE_ID, id: previousId },
      { hover: false }
    );
  }
  if (nextId != null) {
    map.setFeatureState({ source: SOURCE_ID, id: nextId }, { hover: true });
  }
}
