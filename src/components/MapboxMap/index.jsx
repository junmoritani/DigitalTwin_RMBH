import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "./style.css";
import TreeCard from "../TreeCard";
import Toolbar from "../Toolbar";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = TOKEN;

function MapboxMap() {
  // ==================== REFS ====================
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const addModeRef = useRef(false);
  const previewMarkerRef = useRef(null);

  // ==================== STATE ====================
  const [treesData, setTreesData] = useState(null);
  const [selectedTree, setSelectedTree] = useState(null);
  const [zoneamentoVisible, setZoneamentoVisible] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState(null);
  const [showAddOptions, setShowAddOptions] = useState(false);



  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pendingCoords) return;
  
    const pendingSource = map.getSource("pending-tree");
    if (pendingSource) {
      pendingSource.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: pendingCoords,
            },
            properties: {},
          },
        ],
      });
    }
  
    map.flyTo({
      center: pendingCoords,
      zoom: 18,
      essential: true,
    });
  }, [pendingCoords]);


  // ==================== MAP INITIALIZATION ====================
  useEffect(() => {
    if (!TOKEN) {
      console.error("Mapbox token is missing. Check your .env file.");
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [-43.93483, -19.92999],
      zoom: 16.2,
      pitch: 0,
      bearing: 0,
      style: "mapbox://styles/mapbox/standard",
      antialias: true,
    });

    mapRef.current = map;

    map.on("load", () => {
      loadZoneamentoLayer(map);
      loadArvoresLayer(map);
      setupPreviewDot(map);
    });

    setupMapClickHandlers(map);

    return () => map.remove();
  }, []);

  // ==================== LAYER LOADING FUNCTIONS ====================
  const loadZoneamentoLayer = async (map) => {
    try {
      const res = await fetch("/data/Zoneamento_wgs84.geojson");
      const geojson = await res.json();

      const { fillColorExpression } = generateZoneamentoColors(geojson);

      map.addSource("urban-areas", { type: "geojson", data: geojson });
      map.addLayer({
        id: "zoneamento-layer",
        type: "fill",
        source: "urban-areas",
        paint: {
          "fill-color": fillColorExpression,
          "fill-opacity": 0.3,
        },
        layout: { visibility: "none" },
      });
    } catch (err) {
      console.error("Failed to load Zoneamento:", err);
    }
  };

  const loadArvoresLayer = async (map) => {
    try {
      const res = await fetch("/data/Arvores.geojson");
      const geojson = await res.json();
      setTreesData(geojson);

      if (!map.getSource("arvores")) {
        map.addSource("arvores", { type: "geojson", data: geojson });
      }

      if (!map.getLayer("arvores-layer")) {
        map.addLayer({
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
  };

  const setupPreviewDot = (map) => {
    map.addSource("pending-tree", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
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
  };

  // ==================== HELPER FUNCTIONS ====================
  const generateZoneamentoColors = (geojson) => {
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

    geojson.features.forEach((f) => {
      const id = f.properties.ID_ZONEAME;
      if (!idToColor[id]) idToColor[id] = getRandomColor();
    });

    const fillColorExpression = ["match", ["get", "ID_ZONEAME"]];
    Object.entries(idToColor).forEach(([id, color]) => {
      fillColorExpression.push(parseInt(id), color);
    });
    fillColorExpression.push("#cccccc");

    return { fillColorExpression };
  };

  // ==================== MAP EVENT HANDLERS ====================
  const setupMapClickHandlers = (map) => {
    // Select tree on click
    map.on("click", "arvores-layer", (e) => {
      if (e.features.length > 0) {
        const treeData = e.features[0].properties;
        setSelectedTree(treeData);
      }
    });

    // Add tree mode click handler
    map.on("click", (e) => {
      if (!addModeRef.current) return;
      const coords = [e.lngLat.lng, e.lngLat.lat];
      setPendingCoords(coords);

      const pendingSource = map.getSource("pending-tree");
      if (pendingSource) {
        pendingSource.setData({
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
    });
  };

  // ==================== SYNC EFFECTS ====================
  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !treesData) return;
    const source = map.getSource("arvores");
    if (source) source.setData(treesData);
  }, [treesData]);

  // ==================== TREE MANAGEMENT HANDLERS ====================
  const handleAddTreeOnMap = () => {
    setAddMode(true);
    setShowAddOptions(false);
    alert("Clique no mapa para escolher a localização da árvore");
  };

  const handleAddTreeAtMyLocation = () => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported, fallback to manual mode");
      handleAddTreeOnMap();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coords = [longitude, latitude];
        const map = mapRef.current;
        if (!map) return;

        // --- REMOVE Marker logic from here if you want to use the layer dot ---

        // Set state
        setAddMode(true);
        // setShowAddOptions(false);
        setPendingCoords(coords);

        // 🌟 NEW: Update the 'pending-tree' GeoJSON source
        const pendingSource = map.getSource("pending-tree");
        if (pendingSource) {
          pendingSource.setData({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: coords },
                properties: {},
              },
            ],
          });
          console.log("Updated pending-tree source for layer dot.");
        }
        // --------------------------------------------------------------------

        // Then fly to location
        map.flyTo({ center: coords, zoom: 18 });

        // Since you are using a LAYER dot, you might need a different drag/update mechanism
        // or perhaps you intended to use the Marker (see alternative below).

        // For now, let's remove the marker/drag logic that won't work without the marker:
        /*
          const marker = new mapboxgl.Marker({
            color: "#FFA500",
            draggable: true,
          })
            .setLngLat(coords)
            .addTo(map);
          // ... all subsequent marker creation, drag, click, and cleanup logic ...
          */

        // To allow adding/moving the layer dot with clicks, ensure addMode is set:
        // The existing `setupMapClickHandlers` will handle subsequent clicks
        // once `addMode` is `true`.
      },
      (error) => {
        console.error("Error getting location:", error);
        handleAddTreeOnMap();
      }
    );
  };

  // const handleSaveTree = (newTree) => {
  //   // ... existing code for saving tree ...
  //   setTreesData({
  //     ...treesData,
  //     features: [...treesData.features, newTree],
  //   });
  //   setAddMode(false);
  //   setPendingCoords(null);

  //   // 🌟 NEW: Clear the GeoJSON source data
  //   const map = mapRef.current;
  //   const pendingSource = map.getSource("pending-tree");
  //   if (pendingSource) {
  //     pendingSource.setData({ type: "FeatureCollection", features: [] });
  //   }

  //   if (previewMarkerRef.current) {
  //     previewMarkerRef.current.cleanup?.();
  //   }
  // };

  function mapFormToTreeFeature({ formData, coords, nextId }) {
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: coords,
      },
      properties: {
        ID: nextId,
        ID_ARVORE_SIIA: null,

        TIPO_INDIVIDUO: "Árvore",
        LOCAL_PLANTIO: formData.LOCAL_PLANTIO ?? null,
        LOGRADOURO_REFERENCIA: formData.LOGRADOURO_REFERENCIA ?? null,
        NUMERO_REFERENCIA: formData.NUMERO_REFERENCIA ?? null,
        LOCAL_REFERENCIA: null,

        NOME_POPULAR: formData.NOME_POPULAR ?? null,
        NOME_CIENTIFICO: null,

        DATA_LEVANTAMENTO: new Date().toISOString(),
        ORGAO_LEVANTAMENTO: "Colaborativo",

        // Extended attributes (OK if you accept schema evolution)
        CEP: formData.CEP ?? null,
        OBSERVACOES: formData.OBSERVACOES ?? null,
        CLASS_ESPECIAL: formData.CLASS_ESPECIAL ?? null,
        NOVO_PLANTIO: formData.NOVO_PLANTIO ?? null,
        RESPONSAVEL: formData.RESPONSAVEL ?? null,

        UTM_X_SIRGAS_2000: null,
        UTM_Y_SIRGAS_2000: null,
      },
    };
  }

  const handleSaveTree = ({ formData, coords, photoFile }) => {
    if (!coords || !treesData) return;

    const maxId = treesData.features.reduce((max, feature) => {
      const id = feature.properties.ID;
      return id > max ? id : max;
    }, 0);

    const nextId = maxId + 1;

    const newFeature = mapFormToTreeFeature({
      formData,
      coords,
      nextId,
    });

    if (photoFile) {
      console.log("Salvando foto:", photoFile.name);
      // newFeature.properties.foto_temp = photoFile;
    }

    setTreesData((prev) => ({
      ...prev,
      features: [...prev.features, newFeature],
    }));

    // cleanup
    setAddMode(false);
    setPendingCoords(null);
    setShowAddOptions(false);

    const pendingSource = mapRef.current?.getSource("pending-tree");
    pendingSource?.setData({
      type: "FeatureCollection",
      features: [],
    });
  };

  const handleCancelSaveTree = () => {
    setAddMode(false);
    setPendingCoords(null);

    // 🌟 NEW: Clear the GeoJSON source data
    const map = mapRef.current;
    const pendingSource = map.getSource("pending-tree");
    if (pendingSource) {
      pendingSource.setData({ type: "FeatureCollection", features: [] });
    }
  };

  const handleDeleteTree = (id) => {
    if (!treesData) return;
    const newFeatures = treesData.features.filter(
      (f) => f.properties.ID !== id
    );
    setTreesData({ ...treesData, features: newFeatures });
    setSelectedTree(null);
  };

  const toggleZoneamento = () => {
    const map = mapRef.current;
    if (!map) return;

    const visibility = map.getLayoutProperty("zoneamento-layer", "visibility");
    const newVisibility = visibility === "visible" ? "none" : "visible";

    map.setLayoutProperty("zoneamento-layer", "visibility", newVisibility);
    setZoneamentoVisible(newVisibility === "visible");
  };

  // ==================== RENDER ====================
  return (
    <div className="w-full h-full flex min-h-0 flex-row grow overflow-hidden ">
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
        onShowZoneamento={toggleZoneamento}
        zoneamentoVisible={zoneamentoVisible}
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
