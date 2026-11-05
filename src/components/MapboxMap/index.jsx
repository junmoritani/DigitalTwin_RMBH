import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./style.css";
import TreeCard from "../TreeCard";
import Toolbar from "../Toolbar";
import { MAP_BASEMAP_CONFIG, MAP_CENTER, MAP_STYLE, MAP_ZOOM } from "../../map/config";
import {
  addBairroDensityLayer,
  BAIRRO_METRICS,
  DENSITY_FILL_LAYER,
  formatArea,
  formatPct,
  formatTrees,
  setBairroDensityVisible,
  setBairroMetric,
  setHoveredBairro,
} from "../../map/bairroDensity";
import {
  CONTRIBUTION_POPUP_OFFSET,
  addPendingTreeLayer,
  addPlantingLayers,
  addProblemLayers,
  addTreeLayer,
  clearPendingTree,
  clearPlantingDraft,
  clearProblemDraft,
  computeViewportSpeciesBreakdown,
  setPendingTree,
  setPlantingDraft,
  setPlantingSuggestions,
  setProblemDraft,
  setProblemReports,
  setPlantingSuggestionsVisible,
  setProblemReportsVisible,
  setTreeLayerVisible,
  TREE_LAYERS,
  updateTreeLayerStyle,
} from "../../map/layers";
import { nextTreeId, treeFeatureFromForm } from "../../map/treeFeature";
import { useViewportTrees } from "../../map/useViewportTrees";
import { useAuth } from "../../context/AuthContext";
import {
  fetchPlantingSuggestions,
  fetchProblemReports,
  fetchTreeById,
  insertPlantingSuggestion,
  insertProblemReport,
  insertUserTree,
  transformTreeTileRequest,
  treeTilesUrl,
} from "../../lib/treesApi";
import { isSupabaseConfigured } from "../../lib/supabase";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = TOKEN;

function plantingPopupContent(properties) {
  const root = document.createElement("div");
  root.className = "planting-popup-body";

  const title = document.createElement("strong");
  title.textContent = "Sugestão de plantio";
  root.append(title);

  if (properties.FOTO_URL) {
    const photo = document.createElement("img");
    photo.src = properties.FOTO_URL;
    photo.alt = "Foto do local sugerido";
    root.append(photo);
  }

  if (properties.ADDRESS) {
    const address = document.createElement("p");
    address.textContent = properties.ADDRESS;
    root.append(address);
  }
  if (properties.LOCAL_PLANTIO) {
    const place = document.createElement("p");
    place.textContent = properties.LOCAL_PLANTIO;
    root.append(place);
  }
  if (properties.NOTES) {
    const notes = document.createElement("p");
    notes.textContent = properties.NOTES;
    root.append(notes);
  }

  const hint = document.createElement("p");
  hint.className = "planting-popup-hint";
  hint.textContent =
    "Ponto indicado para as equipes avaliarem um novo plantio.";
  root.append(hint);
  return root;
}

const PROBLEM_LABELS = {
  missing: "A árvore não está mais aqui",
  maintenance: "Precisa de manutenção",
  wrong_info: "Os dados estão incorretos",
};

function problemPopupContent(properties) {
  const root = document.createElement("div");
  root.className = "planting-popup-body";

  const title = document.createElement("strong");
  title.textContent = "Problema relatado";
  root.append(title);

  if (properties.FOTO_URL) {
    const photo = document.createElement("img");
    photo.src = properties.FOTO_URL;
    photo.alt = "Foto do problema";
    root.append(photo);
  }

  const kind = document.createElement("p");
  kind.textContent =
    PROBLEM_LABELS[properties.REPORT_TYPE] || "Problema no inventário";
  root.append(kind);

  if (properties.ADDRESS) {
    const address = document.createElement("p");
    address.textContent = properties.ADDRESS;
    root.append(address);
  }
  if (properties.TREE_ID) {
    const tree = document.createElement("p");
    tree.textContent = `Árvore #${properties.TREE_ID}`;
    root.append(tree);
  }
  if (properties.NOTES) {
    const notes = document.createElement("p");
    notes.textContent = properties.NOTES;
    root.append(notes);
  }

  const hint = document.createElement("p");
  hint.className = "planting-popup-hint";
  hint.textContent = "Relato enviado para as equipes responsáveis avaliarem.";
  root.append(hint);
  return root;
}

function MapboxMap({
  focusPlace,
  externalSpeciesFilter,
  onClearExternalSpeciesFilter,
  onUserContribution,
  mobilePane = null,
  onRequestMap,
  onEditorChange,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const addModeRef = useRef(false);
  const plantingModeRef = useRef(false);
  const reportModeRef = useRef(false);
  const suggestionPopupRef = useRef(null);
  const suggestionAbortRef = useRef(null);
  const problemAbortRef = useRef(null);
  const treeDetailAbortRef = useRef(null);
  const refreshSuggestionsRef = useRef(null);
  const refreshProblemsRef = useRef(null);
  const [selectedTree, setSelectedTree] = useState(null);
  const [treesVisible, setTreesVisibleState] = useState(true);
  const [reportsVisible, setReportsVisible] = useState(true);
  const [plantingsVisible, setPlantingsVisible] = useState(true);
  const [addMode, setAddMode] = useState(false);
  const [plantingMode, setPlantingMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState(null);
  const [plantingCoords, setPlantingCoords] = useState(null);
  const [reportMode, setReportMode] = useState(false);
  const [reportCoords, setReportCoords] = useState(null);
  const [reportTree, setReportTree] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    onEditorChange?.(editorOpen);
  }, [editorOpen, onEditorChange]);

  useEffect(() => {
    if (editorOpen) setSelectedTree(null);
    const frame = requestAnimationFrame(() => mapRef.current?.resize());
    return () => cancelAnimationFrame(frame);
  }, [editorOpen, mobilePane]);
  const [mapReady, setMapReady] = useState(false);

  const [bairroMetric, setBairroMetricState] = useState("DENSITY");
  const [bairroFeatures, setBairroFeatures] = useState([]);
  const [treeColorMode, setTreeColorMode] = useState("default");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [pointLegend, setPointLegend] = useState([]);

  const { user, openAuthModal } = useAuth();

  const {
    visibleTrees,
    densityMode,
    hiddenIds,
    refreshTreesInView,
    verifyTileSource,
    handleMapError,
    addLocalTree,
    removeLocalTree,
    stop,
  } = useViewportTrees(mapRef);
  const [densityLegend, setDensityLegend] = useState([]);
  const [hoveredBairro, setHoveredBairroInfo] = useState(null);
  const hoveredIdRef = useRef(null);
  const densityModeRef = useRef(false);
  const refreshRef = useRef(refreshTreesInView);
  const treeErrorRef = useRef(handleMapError);
  const verifyTilesRef = useRef(verifyTileSource);
  const stopRef = useRef(stop);
  refreshRef.current = refreshTreesInView;
  treeErrorRef.current = handleMapError;
  verifyTilesRef.current = verifyTileSource;
  stopRef.current = stop;

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  useEffect(() => {
    plantingModeRef.current = plantingMode;
  }, [plantingMode]);

  useEffect(() => {
    reportModeRef.current = reportMode;
  }, [reportMode]);

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas) return;
    canvas.style.cursor = addMode || plantingMode || reportMode ? "crosshair" : "";
  }, [addMode, plantingMode, reportMode, mapReady]);

  useEffect(() => {
    if (externalSpeciesFilter) {
      setSpeciesFilter(externalSpeciesFilter);
      setTreeColorMode("species");
      onClearExternalSpeciesFilter?.();
    }
  }, [externalSpeciesFilter, onClearExternalSpeciesFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !focusPlace) return;

    if (Array.isArray(focusPlace.bbox) && focusPlace.bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = focusPlace.bbox;
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 48, maxZoom: 15.5, duration: 900 }
      );
      return;
    }

    const zoomByType = {
      address: 17,
      poi: 16.5,
      neighborhood: 15,
      locality: 13,
      place: 12,
    };

    const marker = new mapboxgl.Marker({ color: "#3B755F" })
      .setLngLat(focusPlace.center)
      .addTo(map);
    map.jumpTo({
      center: focusPlace.center,
      zoom: focusPlace.zoom ?? zoomByType[focusPlace.placeType] ?? 15,
    });

    return () => marker.remove();
  }, [mapReady, focusPlace]);

  useEffect(() => {
    densityModeRef.current = densityMode;
    const map = mapRef.current;
    setBairroDensityVisible(map, densityMode);
    if (densityMode) setSelectedTree(null);
    if (!densityMode) {
      setHoveredBairro(map, null, hoveredIdRef.current);
      hoveredIdRef.current = null;
      setHoveredBairroInfo(null);
    }
  }, [densityMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !bairroFeatures.length) return;
    const updated = setBairroMetric(map, bairroFeatures, bairroMetric);
    if (updated) {
      setDensityLegend(updated.legend);
    }
  }, [mapReady, bairroFeatures, bairroMetric]);

  const viewportSpecies = useMemo(() => {
    const features = visibleTrees.features;
    if (!features.length) return [];
    return computeViewportSpeciesBreakdown(features).allSpecies;
  }, [visibleTrees]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const { legend } = updateTreeLayerStyle(map, {
      colorMode: treeColorMode,
      features: visibleTrees.features,
      speciesFilter,
      hiddenIds,
    });
    setPointLegend(legend);
  }, [mapReady, visibleTrees, treeColorMode, speciesFilter, hiddenIds]);

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
      config: { basemap: MAP_BASEMAP_CONFIG },
      antialias: true,
      transformRequest: transformTreeTileRequest,
    });
    mapRef.current = map;

    let active = true;

    map.on("error", (event) => treeErrorRef.current(map, event));

    map.on("load", () => {
      addTreeLayer(map, treeTilesUrl);
      addPendingTreeLayer(map);
      addPlantingLayers(map);
      addProblemLayers(map);

      setMapReady(true);
      refreshRef.current(map);
      verifyTilesRef.current(map);
      refreshSuggestionsRef.current?.(map);
      refreshProblemsRef.current?.(map);

      addBairroDensityLayer(map, "DENSITY")
        .then((density) => {
          if (!active) return;
          setBairroFeatures(density.geojson?.features ?? []);
          setBairroDensityVisible(map, densityModeRef.current);
          setDensityLegend(density.legend);

          map.on("mousemove", DENSITY_FILL_LAYER, (event) => {
            const feature = event.features?.[0];
            if (!feature || !densityModeRef.current) return;
            const nextId = Number(feature.id ?? feature.properties?.ID);
            setHoveredBairro(map, nextId, hoveredIdRef.current);
            hoveredIdRef.current = nextId;
            setHoveredBairroInfo(feature.properties);
            map.getCanvas().style.cursor = "pointer";
          });

          map.on("mouseleave", DENSITY_FILL_LAYER, () => {
            setHoveredBairro(map, null, hoveredIdRef.current);
            hoveredIdRef.current = null;
            setHoveredBairroInfo(null);
            map.getCanvas().style.cursor = "";
          });
        })
        .catch((error) => {
          console.error("Failed to load bairro density:", error);
        });
    });

    map.on("moveend", () => {
      refreshRef.current(map);
      refreshSuggestionsRef.current?.(map);
      refreshProblemsRef.current?.(map);
    });

    map.on("click", TREE_LAYERS, (event) => {
      if (addModeRef.current || plantingModeRef.current || reportModeRef.current) return;
      const feature = event.features?.[0];
      if (!feature) return;
      const coords = feature.geometry?.coordinates;
      const treeId = feature.properties?.ID;
      const preview = {
        ...feature.properties,
        _lng: Array.isArray(coords) ? coords[0] : null,
        _lat: Array.isArray(coords) ? coords[1] : null,
        _loading: true,
      };
      setSelectedTree(preview);
      treeDetailAbortRef.current?.abort();
      const controller = new AbortController();
      treeDetailAbortRef.current = controller;
      fetchTreeById(treeId, controller.signal)
        .then((tree) => {
          if (controller.signal.aborted) return;
          setSelectedTree((current) => {
            if (!current || String(current.ID) !== String(treeId)) return current;
            if (!tree) return { ...current, _loading: false, _detailError: true };
            return {
              ...tree,
              _lng: preview._lng,
              _lat: preview._lat,
              _loading: false,
            };
          });
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          console.error("Failed to load tree details:", error);
          setSelectedTree((current) => {
            if (!current || String(current.ID) !== String(treeId)) return current;
            return { ...current, _loading: false, _detailError: true };
          });
        });
    });

    map.on("click", "planting-suggestions-layer", (event) => {
      if (addModeRef.current || plantingModeRef.current || reportModeRef.current) return;
      const feature = event.features?.[0];
      if (!feature) return;
      suggestionPopupRef.current?.remove();
      suggestionPopupRef.current = new mapboxgl.Popup({
        offset: CONTRIBUTION_POPUP_OFFSET,
        closeButton: true,
        className: "planting-popup",
        maxWidth: "240px",
      })
        .setLngLat(feature.geometry.coordinates)
        .setDOMContent(plantingPopupContent(feature.properties ?? {}))
        .addTo(map);
    });

    map.on("click", "problem-reports-layer", (event) => {
      if (addModeRef.current || plantingModeRef.current || reportModeRef.current) return;
      const feature = event.features?.[0];
      if (!feature) return;
      suggestionPopupRef.current?.remove();
      suggestionPopupRef.current = new mapboxgl.Popup({
        offset: CONTRIBUTION_POPUP_OFFSET,
        closeButton: true,
        className: "planting-popup",
        maxWidth: "240px",
      })
        .setLngLat(feature.geometry.coordinates)
        .setDOMContent(problemPopupContent(feature.properties ?? {}))
        .addTo(map);
    });

    map.on("click", (event) => {
      const coords = [event.lngLat.lng, event.lngLat.lat];
      if (reportModeRef.current) {
        const treeHit = map.getLayer("arvores-layer")
          ? map.queryRenderedFeatures(event.point, {
              layers: TREE_LAYERS.filter((id) => map.getLayer(id)),
            })[0]
          : null;
        const treeCoords = treeHit?.geometry?.coordinates;
        const nextCoords = Array.isArray(treeCoords)
          ? [treeCoords[0], treeCoords[1]]
          : coords;
        setReportCoords(nextCoords);
        setReportDraft(map, nextCoords);
        setReportTree(
          treeHit
            ? {
                ...treeHit.properties,
                _lng: nextCoords[0],
                _lat: nextCoords[1],
              }
            : null
        );
        setSelectedTree(null);
        return;
      }
      if (plantingModeRef.current) {
        setPlantingCoords(coords);
        setPlantingDraft(map, coords);
        return;
      }
      if (!addModeRef.current) return;
      setPendingCoords(coords);
      setPendingTree(map, coords);
    });

    return () => {
      active = false;
      setMapReady(false);
      suggestionAbortRef.current?.abort();
      problemAbortRef.current?.abort();
      treeDetailAbortRef.current?.abort();
      suggestionPopupRef.current?.remove();
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

  const handlePlantingAtMyLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        const map = mapRef.current;
        if (!map) return;
        setPlantingMode(true);
        setPlantingCoords(coords);
        setPlantingDraft(map, coords);
        map.flyTo({ center: coords, zoom: 18 });
      },
      (error) => {
        console.error("Error getting location:", error);
      }
    );
  };

  const handleSaveTree = async ({ formData, coords, photoFile }) => {
    if (!coords) {
      throw new Error("Escolha um ponto no mapa antes de salvar.");
    }

    if (!user) {
      openAuthModal(
        "login",
        "Faça login na sua conta para salvar uma nova árvore no inventário."
      );
      throw new Error("Autenticação necessária para salvar.");
    }

    let createdFeature = null;

    if (isSupabaseConfigured) {
      createdFeature = await insertUserTree({
        formData,
        coords,
        photoFile,
        user,
      });
    } else {
      createdFeature = treeFeatureFromForm({
        formData,
        coords,
        nextId: nextTreeId(visibleTrees.features),
      });
      if (photoFile) {
        createdFeature.properties.FOTO_URL = URL.createObjectURL(photoFile);
      }
    }

    if (!createdFeature) {
      throw new Error("Não foi possível salvar a árvore no banco de dados.");
    }

    addLocalTree(createdFeature);
    onUserContribution?.();
    setAddMode(false);
    setPendingCoords(null);
    clearPendingTree(mapRef.current);
  };

  const handleCancelSaveTree = () => {
    setAddMode(false);
    setPendingCoords(null);
    clearPendingTree(mapRef.current);
  };

  const refreshSuggestions = async (map) => {
    if (!map) return;
    suggestionAbortRef.current?.abort();
    const controller = new AbortController();
    suggestionAbortRef.current = controller;
    try {
      const geojson = await fetchPlantingSuggestions(
        map.getBounds(),
        controller.signal
      );
      if (controller.signal.aborted) return;
      setPlantingSuggestions(map, geojson);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Failed to load planting suggestions:", error);
    }
  };
  refreshSuggestionsRef.current = refreshSuggestions;

  const handleSavePlanting = async ({
    notes,
    logradouro,
    numero,
    cep,
    localPlantio,
    photoFile,
  }) => {
    if (!plantingCoords) {
      throw new Error("Escolha um ponto no mapa antes de enviar.");
    }
    if (!user) {
      openAuthModal(
        "login",
        "Entre na sua conta para indicar um local de plantio."
      );
      throw new Error("Autenticação necessária para indicar um local de plantio.");
    }

    await insertPlantingSuggestion({
      coords: plantingCoords,
      notes,
      logradouro,
      numero,
      cep,
      localPlantio,
      photoFile,
      user,
    });
    setPlantingMode(false);
    setPlantingCoords(null);
    clearPlantingDraft(mapRef.current);
    await refreshSuggestions(mapRef.current);
    onUserContribution?.();
  };

  const handleCancelPlanting = () => {
    setPlantingMode(false);
    setPlantingCoords(null);
    clearPlantingDraft(mapRef.current);
  };

  const refreshProblems = async (map) => {
    if (!map) return;
    problemAbortRef.current?.abort();
    const controller = new AbortController();
    problemAbortRef.current = controller;
    try {
      const geojson = await fetchProblemReports(map.getBounds(), controller.signal);
      if (controller.signal.aborted) return;
      setProblemReports(map, geojson);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Failed to load problem reports:", error);
    }
  };
  refreshProblemsRef.current = refreshProblems;

  const handleReportAtMyLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        const map = mapRef.current;
        if (!map) return;
        setReportMode(true);
        setReportCoords(coords);
        setReportTree(null);
        setProblemDraft(map, coords);
        map.flyTo({ center: coords, zoom: 18 });
      },
      (error) => {
        console.error("Error getting location:", error);
      }
    );
  };

  const handleSaveProblem = async ({
    reportType,
    notes,
    logradouro,
    numero,
    cep,
    photoFile,
  }) => {
    if (!reportCoords) {
      throw new Error("Escolha um ponto no mapa antes de enviar.");
    }
    if (!user) {
      openAuthModal(
        "login",
        "Entre na sua conta para relatar um problema."
      );
      throw new Error("Autenticação necessária para relatar um problema.");
    }

    await insertProblemReport({
      coords: reportCoords,
      reportType,
      notes,
      logradouro,
      numero,
      cep,
      photoFile,
      treeId: reportTree?.ID || null,
      user,
    });
    setReportMode(false);
    setReportCoords(null);
    setReportTree(null);
    clearProblemDraft(mapRef.current);
    await refreshProblems(mapRef.current);
    onUserContribution?.();
  };

  const handleCancelProblem = () => {
    setReportMode(false);
    setReportCoords(null);
    setReportTree(null);
    clearProblemDraft(mapRef.current);
  };

  const handleDeleteTree = (id) => {
    if (!user) {
      openAuthModal(
        "login",
        "Faça login na sua conta para remover ou reportar uma árvore."
      );
      return;
    }
    removeLocalTree(id);
    setSelectedTree(null);
  };

  const handleTreesChange = (visible) => {
    const applied = setTreeLayerVisible(mapRef.current, visible);
    if (applied !== null) setTreesVisibleState(applied);
  };

  const handleReportsChange = (visible) => {
    const applied = setProblemReportsVisible(mapRef.current, visible);
    if (applied === null) return;
    setReportsVisible(applied);
    if (!applied) suggestionPopupRef.current?.remove();
  };

  const handlePlantingsChange = (visible) => {
    const applied = setPlantingSuggestionsVisible(mapRef.current, visible);
    if (applied === null) return;
    setPlantingsVisible(applied);
    if (!applied) suggestionPopupRef.current?.remove();
  };

  const activeMetricMeta =
    BAIRRO_METRICS[bairroMetric] || BAIRRO_METRICS.DENSITY;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-row overflow-hidden">
      <Toolbar
        pendingCoords={pendingCoords}
        setAddMode={setAddMode}
        handleAddTreeAtMyLocation={handleAddTreeAtMyLocation}
        onSaveTree={handleSaveTree}
        onCancelAdd={handleCancelSaveTree}
        onTreesChange={handleTreesChange}
        treesVisible={treesVisible}
        onReportsChange={handleReportsChange}
        reportsVisible={reportsVisible}
        onPlantingsChange={handlePlantingsChange}
        plantingsVisible={plantingsVisible}
        densityMode={densityMode}
        bairroMetric={bairroMetric}
        onBairroMetricChange={setBairroMetricState}
        treeColorMode={treeColorMode}
        onTreeColorModeChange={setTreeColorMode}
        speciesFilter={speciesFilter}
        onSpeciesFilterChange={setSpeciesFilter}
        viewportSpecies={viewportSpecies}
        pointLegend={pointLegend}
        user={user}
        onRequestAuth={openAuthModal}
        setPlantingMode={setPlantingMode}
        plantingCoords={plantingCoords}
        onSavePlanting={handleSavePlanting}
        onCancelPlanting={handleCancelPlanting}
        onPlantingAtMyLocation={handlePlantingAtMyLocation}
        setReportMode={setReportMode}
        reportCoords={reportCoords}
        reportTree={reportTree}
        onSaveProblem={handleSaveProblem}
        onCancelProblem={handleCancelProblem}
        onReportAtMyLocation={handleReportAtMyLocation}
        onEditorChange={setEditorOpen}
        mobilePane={mobilePane}
        onRequestMap={onRequestMap}
      />

      <div
        className={`map-stage ${
          mobilePane === "layers" || mobilePane === "edit" ? "max-md:hidden" : ""
        }`}
      >
        <div ref={mapContainerRef} className="map-container" />

        {densityMode && hoveredBairro && (
          <div className="density-tip">
            <strong>{hoveredBairro.NOME}</strong>
            <span>
              {formatTrees(hoveredBairro.TREE_COUNT)} árvores em{" "}
              {formatArea(hoveredBairro.AREA_KM2)} km²
            </span>
            <span>
              <strong>{formatTrees(hoveredBairro.TREES_PER_KM2)}</strong>{" "}
              árvores/km² ·{" "}
              <strong>{formatTrees(hoveredBairro.SPECIES_COUNT)}</strong>{" "}
              espécies
            </span>
            {hoveredBairro.TOP_SPECIES && (
              <span className="text-xs text-gray-600">
                Dominante: {hoveredBairro.TOP_SPECIES} (
                {formatPct(hoveredBairro.TOP_SPECIES_SHARE)}%)
              </span>
            )}
          </div>
        )}

        {densityMode && densityLegend.length > 0 && (
          <div className="density-legend">
            <h2>{activeMetricMeta.title}</h2>
            <p>{activeMetricMeta.subtitle}</p>
            <ul>
              {densityLegend.map((item) => (
                <li key={item.label}>
                  <span
                    className="density-swatch"
                    style={{ background: item.color }}
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {selectedTree && (
          <TreeCard
            tree={selectedTree}
            loading={Boolean(selectedTree._loading)}
            detailError={Boolean(selectedTree._detailError)}
            onClose={() => setSelectedTree(null)}
            onDelete={handleDeleteTree}
            onReportSubmitted={() => onUserContribution?.()}
          />
        )}
      </div>
    </div>
  );
}

export default MapboxMap;
