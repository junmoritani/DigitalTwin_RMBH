import "./App.css";
import CesiumMap from "./components/CesiumMap";
import LeafLetMap from "./components/LeafletMap";
import MapboxMap from "./components/MapboxMap";

function App() {
  return (
    <>
      {/* <CesiumMap /> */}
      {/* <LeafLetMap /> */}
      <MapboxMap />
    </>
  );
}

export default App;
