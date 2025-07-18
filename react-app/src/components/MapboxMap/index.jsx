import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "./style.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function MapboxMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!TOKEN) {
      console.error("Mapbox token is missing. Check your .env file.");
      return;
    }

    mapboxgl.accessToken = TOKEN;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [-43.93483, -19.92999],
      zoom: 16.2,
      pitch: 40,
      bearing: 0,
      style: "mapbox://styles/mapbox/standard",
    });

    mapRef.current.on("load", () => {
      fetch("/data/Zoneamento_wgs84.geojson")
        .then((res) => res.json())
        .then((geojson) => {
          const idToColor = {};
          const usedColors = new Set();

          const getRandomColor = () => {
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
            if (!idToColor[id]) {
              idToColor[id] = getRandomColor();
            }
          });

          const fillColorExpression = ["match", ["get", "ID_ZONEAME"]];
          Object.entries(idToColor).forEach(([id, color]) => {
            fillColorExpression.push(parseInt(id), color);
          });
          fillColorExpression.push("#cccccc"); // fallback color

          mapRef.current.addSource("urban-areas", {
            type: "geojson",
            data: geojson,
          });

          mapRef.current.addLayer({
            id: "bairros-populares",
            type: "fill",
            source: "urban-areas",
            paint: {
              "fill-color": fillColorExpression,
              "fill-opacity": 0.3,
              "line-color": "#333",
              "line-width": 1,
            },
          });
        });
    });

    return () => mapRef.current?.remove();
  }, []);

  return <div ref={mapContainerRef} id="map" className="map-container" />;
}

export default MapboxMap;
