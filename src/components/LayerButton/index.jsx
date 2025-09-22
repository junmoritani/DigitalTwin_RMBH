import "./style.css";

function LayerButton({ showLayer, zoneamentoVisible }) {
  return (
    <div className="bt-container">
      <div className="imageLayer"></div>
      <button
        className={`toggle-btn ${zoneamentoVisible ? "active" : ""}`}
        onClick={() => showLayer(true)}
      >
        {zoneamentoVisible ? "Hide Zoneamento" : "Show Zoneamento"}
      </button>
    </div>
  );
}

export default LayerButton;
