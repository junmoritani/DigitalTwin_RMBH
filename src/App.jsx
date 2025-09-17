import "./App.css";
import CesiumMap from "./components/CesiumMap";
import LeafLetMap from "./components/LeafletMap";
import MapboxMap from "./components/MapboxMap";
import Header from "./components/Header";

function App() {
  return (
    <>
      <div className="mainElements-container">
        <Header />
        {/* <CesiumMap /> */}
        {/* <LeafLetMap /> */}
        <MapboxMap />
      </div>
    </>
  );
}

export default App;
