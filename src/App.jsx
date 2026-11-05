import { useCallback, useState } from "react";
import "./App.css";
import Header from "./components/Header";
import MapboxMap from "./components/MapboxMap";
import Dashboard from "./components/Dashboard";
import AuthModal from "./components/AuthModal";
import MobileTabBar from "./components/MobileTabBar";
import { AuthProvider } from "./context/AuthContext";

function App() {
  const [focusPlace, setFocusPlace] = useState(null);
  const [activeView, setActiveView] = useState("map");
  const [mobileTab, setMobileTab] = useState("map");
  const [externalSpeciesFilter, setExternalSpeciesFilter] = useState("");
  const [userContributionCount, setUserContributionCount] = useState(0);
  const [editing, setEditing] = useState(false);

  const selectMobileTab = (tab) => {
    setMobileTab(tab);
    setActiveView(tab === "dashboard" ? "dashboard" : "map");
  };

  const handleFlyToBairro = useCallback((bairro) => {
    setActiveView("map");
    if (Array.isArray(bairro.bbox) && bairro.bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = bairro.bbox;
      setFocusPlace({
        id: `bairro-${bairro.id}`,
        label: bairro.nome,
        bbox: bairro.bbox,
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
        placeType: "neighborhood",
      });
    }
  }, []);

  const handleFilterSpeciesOnMap = useCallback((speciesName) => {
    setActiveView("map");
    setExternalSpeciesFilter(speciesName);
  }, []);

  const clearExternalSpecies = useCallback(() => {
    setExternalSpeciesFilter("");
  }, []);

  return (
    <AuthProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden font-montserrat">
        <Header
          onSelectPlace={setFocusPlace}
          activeView={activeView}
          onChangeView={(view) => {
            setActiveView(view);
            setMobileTab(view === "dashboard" ? "dashboard" : "map");
          }}
          userContributionCount={userContributionCount}
          mobileTab={mobileTab}
          dimmed={editing && activeView === "map"}
        />

        <div
          className={
            activeView === "map"
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "hidden"
          }
        >
          <MapboxMap
            focusPlace={focusPlace}
            externalSpeciesFilter={externalSpeciesFilter}
            onClearExternalSpeciesFilter={clearExternalSpecies}
            onUserContribution={() =>
              setUserContributionCount((prev) => prev + 1)
            }
            mobilePane={mobileTab === "dashboard" ? null : mobileTab}
            onRequestMap={() => selectMobileTab("map")}
            onEditorChange={setEditing}
          />
        </div>

        {activeView === "dashboard" && (
          <Dashboard
            onFlyToBairro={handleFlyToBairro}
            onFilterSpeciesOnMap={handleFilterSpeciesOnMap}
          />
        )}

        <AuthModal />
        <MobileTabBar active={mobileTab} onChange={selectMobileTab} />
      </div>
    </AuthProvider>
  );
}

export default App;
