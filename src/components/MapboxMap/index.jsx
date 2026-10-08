import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "./style.css";
import TreeCard from "../TreeCard";
import Toolbar from "../Toolbar";
import { MAP_CENTER, MAP_STYLE, MAP_ZOOM } from "../../map/config";
import {
  addPendingTreeLayer,
  addTreeLayer,
  clearPendingTree,
  setPendingTree,
} from "../../map/layers";
import { nextTreeId, treeFeatureFromForm } from "../../map/treeFeature";
import { useViewportTrees } from "../../map/useViewportTrees";
import {
  addZoneamentoLayer,
  toggleZoneamentoVisibility,
} from "../../map/zoneamento";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = TOKEN;

function MapboxMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const addModeRef = useRef(false);
  const [selectedTree, setSelectedTree] = useState(null);
  const [zoneamentoVisible, setZoneamentoVisible] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState(null);

  const { treesData, refreshTreesInView, addLocalTree, removeLocalTree, stop } =
    useViewportTrees(mapRef);
  const refreshRef = useRef(refreshTreesInView);
  const stopRef = useRef(stop);
  refreshRef.current = refreshTreesInView;
  stopRef.current = stop;

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  useEffect(() => {
    if (!TOKEN) {
      console.error("Mapbox token is missing. Check your .env file.");
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: 0,
      bearing: 0,
      style: MAP_STYLE,
      antialias: true,
    });
    mapRef.current = map;

    map.on("load", () => {
      addZoneamentoLayer(map);
      addTreeLayer(map);
      addPendingTreeLayer(map);
      refreshRef.current(map);
    });

    map.on("moveend", () => refreshRef.current(map));

    map.on("click", "arvores-layer", (event) => {
      const feature = event.features?.[0];
      if (feature) setSelectedTree(feature.properties);
    });

    map.on("click", (event) => {
      if (!addModeRef.current) return;
      const coords = [event.lngLat.lng, event.lngLat.lat];
      setPendingCoords(coords);
      setPendingTree(map, coords);
    });

    return () => {
      stopRef.current();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const askForMapClick = () => {
    setAddMode(true);
    alert("Clique no mapa para escolher a localização da árvore");
  };

  const handleAddTreeAtMyLocation = () => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported, fallback to manual mode");
      askForMapClick();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        const map = mapRef.current;
        if (!map) return;

        setAddMode(true);
        setPendingCoords(coords);
        setPendingTree(map, coords);
        map.flyTo({ center: coords, zoom: 18 });
      },
      (error) => {
        console.error("Error getting location:", error);
        askForMapClick();
      }
    );
  };

  const handleSaveTree = ({ formData, coords, photoFile }) => {
    if (!coords || !treesData) return;

    const feature = treeFeatureFromForm({
      formData,
      coords,
      nextId: nextTreeId(treesData.features),
    });

    if (photoFile) {
      console.log("Salvando foto:", photoFile.name);
    }

    addLocalTree(feature);
    setAddMode(false);
    setPendingCoords(null);
    clearPendingTree(mapRef.current);
  };

  const handleCancelSaveTree = () => {
    setAddMode(false);
    setPendingCoords(null);
    clearPendingTree(mapRef.current);
  };

  const handleDeleteTree = (id) => {
    removeLocalTree(id);
    setSelectedTree(null);
  };

  const toggleZoneamento = () => {
    const visible = toggleZoneamentoVisibility(mapRef.current);
    if (visible !== null) setZoneamentoVisible(visible);
  };

  return (
    <div className="w-full h-full flex min-h-0 flex-row grow overflow-hidden ">
      <Toolbar
        pendingCoords={pendingCoords}
        setAddMode={setAddMode}
        handleAddTreeAtMyLocation={handleAddTreeAtMyLocation}
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
