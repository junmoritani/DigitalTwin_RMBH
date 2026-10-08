import "./App.css";
import Header from "./components/Header";
import MapboxMap from "./components/MapboxMap";

function App() {
  return (
    <div className="font-montserrat w-screen h-screen flex flex-col">
      <Header />
      <MapboxMap />
    </div>
  );
}

export default App;
