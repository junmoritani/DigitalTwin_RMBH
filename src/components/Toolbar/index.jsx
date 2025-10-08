import AddTreeButton from "../AddTreeButton";
import AddTreeForm from "../AddTreeForm";
import LayerButton from "../LayerButton";
import "./style.css";

function Toolbar({
  addMode,
  setAddMode,
  pendingCoords,
  onSaveTree,
  onCancelAdd,
  AddTreeAtMyLocation,
  onShowZoneamento,
  zoneamentoVisible,

  handleAddTreeOnMap,
  handleAddTreeAtMyLocation,
  showAddOptions,
  setShowAddOptions,
}) {
  return (
    <div className="toolbar">
      <div className="addTreeButtons-container">
        {/* <AddTreeButton addMode={addMode} setAddMode={setAddMode} />
        <button onClick={AddTreeAtMyLocation}>
          📍 Add Tree at My Location
        </button> */}
        <button onClick={() => setShowAddOptions(true)}>
          Adicionar árvore
        </button>

        {showAddOptions && (
          <div className="add-options">
            <button onClick={handleAddTreeAtMyLocation}>
              📍 Na minha localização
            </button>
            <button onClick={handleAddTreeOnMap}>🗺️ Selecionar no mapa</button>
          </div>
        )}

        {pendingCoords && (
          <AddTreeForm
            coords={pendingCoords}
            onSave={onSaveTree}
            onCancel={onCancelAdd}
          />
        )}
      </div>
      <div className="layerButtons-container">
        <LayerButton
          showLayer={onShowZoneamento}
          zoneamentoVisible={zoneamentoVisible}
        />
      </div>
    </div>
  );
}

export default Toolbar;
