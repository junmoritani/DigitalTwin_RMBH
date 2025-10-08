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
  const [zoneamentoVisible, setZoneamentoVisible] = useState(false);

  const [addMode, setAddMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState(null);
  const [showAddOptions, setShowAddOptions] = useState(false);

  // checks mapbox token
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

    // extra map content
    mapRef.current.on("load", async () => {
      //_____________________________________________________________ZONEAMENTO;
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
            id: "zoneamento-layer",
            type: "fill",
            source: "urban-areas",
            paint: {
              "fill-color": fillColorExpression,
              "fill-opacity": 0.3,
              "line-color": "#333",
              "line-width": 1,
            },
            layout: {
              visibility: "none", // start hidden
            },
          });
        });

      //_____________________________________________________________LOTES
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
      //_____________________________________________________________ARVORES
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

    // ____________________________________________________ add tree mode
    mapRef.current.on("click", (e) => {
      if (!addModeRef.current) return;
      setPendingCoords([e.lngLat.lng, e.lngLat.lat]);
      // setAddMode(false);
    });

    return () => mapRef.current?.remove();
  }, []);

  // useEffect(() => {
  //   if (!mapRef.current) return;

  //   const handleClick = (e) => {
  //     if (!addModeRef.current) return;
  //     const coords = [e.lngLat.lng, e.lngLat.lat];
  //     setPendingCoords(coords);
  //     setAddMode(false);
  //   };

  //   mapRef.current.on("click", handleClick);
  //   return () => mapRef.current.off("click", handleClick);
  // }, []);

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

  // Selecionar no mapa
  const handleAddTreeOnMap = () => {
    setAddMode(true);
    setShowAddOptions(false);
    alert("Clique no mapa para escolher a localização da árvore");
  };

  //__________________________________________________choosing location of new tree in the map
  const handleAddTreeAtMyLocation = () => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported, fallback to map");
      handleAddTreeOnMap();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coords = [longitude, latitude];

        setPendingCoords(coords);
        setAddMode(false);
        setShowAddOptions(false);

        mapRef.current?.flyTo({ center: coords, zoom: 18 });
      },
      (error) => {
        console.error("Error getting location:", error);
        handleAddTreeOnMap(); // fallback automático
      }
    );
  };

  //saves the new tree
  const handleSaveTree = (newTree) => {
    setTreesData({
      ...treesData,
      features: [...treesData.features, newTree],
    });
    setAddMode(false);
    setPendingCoords(null);
  };

  const handleCancelSaveTree = () => {
    setAddMode(false);
    setPendingCoords(null);
  };

  //deletes tree
  const handleDeleteTree = (id) => {
    if (!treesData) return;
    const newFeatures = treesData.features.filter(
      (f) => f.properties.ID !== id
    );
    setTreesData({ ...treesData, features: newFeatures });
    setSelectedTree(null);
  };

  //toggles visibility of zoneamento layer
  const toggleZoneamento = () => {
    if (!mapRef.current) return;

    const visibility = mapRef.current.getLayoutProperty(
      "zoneamento-layer",
      "visibility"
    );

    if (visibility === "visible") {
      mapRef.current.setLayoutProperty(
        "zoneamento-layer",
        "visibility",
        "none"
      );
      setZoneamentoVisible(false);
    } else {
      mapRef.current.setLayoutProperty(
        "zoneamento-layer",
        "visibility",
        "visible"
      );
      setZoneamentoVisible(true);
    }
  };

  //final html
  return (
    <div className="map">
      <Toolbar
        addMode={addMode}
        setAddMode={setAddMode}
        pendingCoords={pendingCoords}
        setPendingCoords={setPendingCoords}
        handleAddTreeOnMap={handleAddTreeOnMap}
        handleAddTreeAtMyLocation={handleAddTreeAtMyLocation}
        showAddOptions={showAddOptions}
        setShowAddOptions={setShowAddOptions}
        onSaveTree={handleSaveTree}
        onCancelAdd={handleCancelSaveTree}
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
