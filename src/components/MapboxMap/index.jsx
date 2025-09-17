import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "./style.css";
import TreeCard from "../TreeCard";
import Toolbar from "../Toolbar";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = TOKEN; // set once, outside component

function MapboxMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const addModeRef = useRef(false);

  const [treesData, setTreesData] = useState(null);
  const [selectedTree, setSelectedTree] = useState(null);

  const [addMode, setAddMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState(null);

  useEffect(() => {
    if (!TOKEN) {
      console.error("Mapbox token is missing. Check your .env file.");
      return;
    }

    // init map
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [-43.93483, -19.92999],
      zoom: 16.2,
      pitch: 40,
      bearing: 0,
      style: "mapbox://styles/mapbox/standard",
      antialias: true,
    });

    // load trees
    mapRef.current.on("load", async () => {
      // ________________________________________ZONEAMENTO;
      // fetch("/data/Zoneamento_wgs84.geojson")
      //   .then((res) => res.json())
      //   .then((geojson) => {
      //     const idToColor = {};
      //     const usedColors = new Set();
      //     const getRandomColor = () => {
      //       let color;
      //       do {
      //         color = `#${Math.floor(Math.random() * 16777215)
      //           .toString(16)
      //           .padStart(6, "0")}`;
      //       } while (usedColors.has(color));
      //       usedColors.add(color);
      //       return color;
      //     };
      //     geojson.features.forEach((feature) => {
      //       const id = feature.properties.ID_ZONEAME;
      //       if (!idToColor[id]) {
      //         idToColor[id] = getRandomColor();
      //       }
      //     });
      //     const fillColorExpression = ["match", ["get", "ID_ZONEAME"]];
      //     Object.entries(idToColor).forEach(([id, color]) => {
      //       fillColorExpression.push(parseInt(id), color);
      //     });
      //     fillColorExpression.push("#cccccc"); // fallback color
      //     mapRef.current.addSource("urban-areas", {
      //       type: "geojson",
      //       data: geojson,
      //     });
      //     mapRef.current.addLayer({
      //       id: "bairros-populares",
      //       type: "fill",
      //       source: "urban-areas",
      //       paint: {
      //         "fill-color": fillColorExpression,
      //         "fill-opacity": 0.3,
      //         "line-color": "#333",
      //         "line-width": 1,
      //       },
      //     });
      //   });
      // setStyleLoaded(true);
      //________________________________________LOTES
      // fetch("/data/Lotes.geojson")
      //   .then((res) => res.json())
      //   .then((geojson) => {
      //     if (!mapRef.current.getSource("lotes")) {
      //       mapRef.current.addSource("lotes", {
      //         type: "geojson",
      //         data: geojson,
      //       });
      //     }

      //     mapRef.current.addLayer({
      //       id: "lotes-layer",
      //       type: "line",
      //       source: "lotes",
      //       paint: {
      //         "line-color": "rgba(175, 175, 175, 0.9)",

      //         "line-width": 1,
      //       },
      //     });
      //   });

      try {
        const res = await fetch("/data/Arvores.geojson");
        if (!res.ok) throw new Error(res.statusText);
        const geojson = await res.json();
        setTreesData(geojson);

        if (!mapRef.current.getSource("arvores")) {
          mapRef.current.addSource("arvores", {
            type: "geojson",
            data: geojson,
          });
        }

        if (!mapRef.current.getLayer("arvores-layer")) {
          mapRef.current.addLayer({
            id: "arvores-layer",
            type: "circle",
            source: "arvores",
            paint: {
              "circle-radius": 5,
              "circle-color": "#38a169",
            },
          });
        }
      } catch (e) {
        console.error("Failed to load Arvores:", e);
      }
    });

    // select tree
    mapRef.current.on("click", "arvores-layer", (e) => {
      if (e.features.length > 0) {
        const treeData = e.features[0].properties;
        setSelectedTree(treeData);
      }
    });

    // add tree mode
    mapRef.current.on("click", (e) => {
      if (!addModeRef.current) return;
      setPendingCoords([e.lngLat.lng, e.lngLat.lat]);
      setAddMode(false);
    });

    return () => mapRef.current?.remove();
  }, []);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  // Keep map updated if treesData changes
  useEffect(() => {
    if (mapRef.current && treesData) {
      const source = mapRef.current.getSource("arvores");
      if (source) source.setData(treesData);
    }
  }, [treesData]);

  const handleSaveTree = (newTree) => {
    setTreesData({
      ...treesData,
      features: [...treesData.features, newTree],
    });
    setPendingCoords(null);
  };

  const handleDeleteTree = (id) => {
    if (!treesData) return;
    const newFeatures = treesData.features.filter(
      (f) => f.properties.ID !== id
    );
    setTreesData({ ...treesData, features: newFeatures });
    setSelectedTree(null);
  };
  return (
    <div className="map">
      <Toolbar
        addMode={addMode}
        setAddMode={setAddMode}
        pendingCoords={pendingCoords}
        onSaveTree={handleSaveTree}
        onCancelAdd={() => setPendingCoords(null)}
      />

      <div ref={mapContainerRef} className="map-container" />

      {selectedTree && (
        <TreeCard
          tree={selectedTree}
          onClose={() => setSelectedTree(null)}
          onDelete={handleDeleteTree}
        />
      )}
    </div>
  );
}

export default MapboxMap;
