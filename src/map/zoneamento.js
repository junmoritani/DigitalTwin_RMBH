function fillColorExpression(geojson) {
  const idToColor = {};
  const usedColors = new Set();

  const nextColor = () => {
    let color;
    do {
      color = `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`;
    } while (usedColors.has(color));
    usedColors.add(color);
    return color;
  };

  geojson.features.forEach((feature) => {
    const id = feature.properties.ID_ZONEAME;
    if (!idToColor[id]) idToColor[id] = nextColor();
  });

  const expression = ["match", ["get", "ID_ZONEAME"]];
  Object.entries(idToColor).forEach(([id, color]) => {
    expression.push(parseInt(id, 10), color);
  });
  expression.push("#cccccc");
  return expression;
}

export async function addZoneamentoLayer(map) {
  try {
    const response = await fetch("/data/Zoneamento_wgs84.geojson");
    const geojson = await response.json();

    map.addSource("urban-areas", { type: "geojson", data: geojson });
    map.addLayer({
      id: "zoneamento-layer",
      type: "fill",
      source: "urban-areas",
      paint: {
        "fill-color": fillColorExpression(geojson),
        "fill-opacity": 0.3,
      },
      layout: { visibility: "none" },
    });

    if (map.getLayer("arvores-layer")) {
      map.moveLayer("arvores-layer");
    }
  } catch (error) {
    console.error("Failed to load Zoneamento:", error);
  }
}

export function toggleZoneamentoVisibility(map) {
  if (!map?.getLayer("zoneamento-layer")) return null;

  const visibility = map.getLayoutProperty("zoneamento-layer", "visibility");
  const nextVisibility = visibility === "visible" ? "none" : "visible";
  map.setLayoutProperty("zoneamento-layer", "visibility", nextVisibility);
  return nextVisibility === "visible";
}
