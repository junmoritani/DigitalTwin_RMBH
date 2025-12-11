import AddTreeButton from "../AddTreeButton";
import AddTreeForm from "../AddTreeForm";
import LayerButton from "../LayerButton";
import { IoLayers } from "react-icons/io5";
import { BiSolidPencil } from "react-icons/bi";
import "./style.css";
import Button from "../Button";

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
    <div className="flex flex-col justify-between p-3 bg-gray-50 h-full">
      <div className="addTreeButtons-container h-full">
        {/* <AddTreeButton addMode={addMode} setAddMode={setAddMode} />
        <button onClick={AddTreeAtMyLocation}>
          📍 Add Tree at My Location
        </button> */}
        <div className="flex gap-3 w-80">
          <Button
            variant="secondary"
            text="Camadas"
            Icon={IoLayers} // <-- Pass the imported component
            onClick={() => console.log("New Item added!")}
          />
          <Button
            variant="secondary"
            text="Editar Mapa"
            Icon={BiSolidPencil} // <-- Pass the imported component
            onClick={() => setShowAddOptions(true)}
          />
        </div>
        
        <Button
            variant="secondary"
            text="Adicionar árvore"
            onClick={() => setShowAddOptions(true)}
          />

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
      <div className="flex flex-col p-3 gap-3 rounded-md bg-white">
        <h1 className=" text-PrimaryLight font-bold">condições atuais</h1>
        <LayerButton
          showLayer={onShowZoneamento}
          zoneamentoVisible={zoneamentoVisible}
        />
      </div>
    </div>
  );
}

export default Toolbar;
