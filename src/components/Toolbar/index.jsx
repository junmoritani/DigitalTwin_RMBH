import AddTreeButton from "../AddTreeButton";
import AddTreeForm from "../AddTreeForm";
import "./style.css";

function Toolbar({
  addMode,
  setAddMode,
  pendingCoords,
  onSaveTree,
  onCancelAdd,
  AddTreeAtMyLocation,
}) {
  return (
    <div className="toolbar">
      <AddTreeButton addMode={addMode} setAddMode={setAddMode} />
      <button onClick={AddTreeAtMyLocation}>📍 Add Tree at My Location</button>

      {pendingCoords && (
        <AddTreeForm
          coords={pendingCoords}
          onSave={onSaveTree}
          onCancel={onCancelAdd}
        />
      )}
    </div>
  );
}

export default Toolbar;
