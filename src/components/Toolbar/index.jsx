import { useState } from "react";
import AddTreeForm from "../AddTreeForm";
import LayerButton from "../LayerButton";
import { IoLayers } from "react-icons/io5";
import { BiSolidPencil } from "react-icons/bi";
import "./style.css";
import Button from "../Button";

function Toolbar({
  pendingCoords,
  onSaveTree,
  onCancelAdd,
  onShowZoneamento,
  zoneamentoVisible,
  handleAddTreeAtMyLocation,
  setAddMode,
}) {
  const TOOLBAR = {
    LAYERS: "layers",
    EDIT: "edit",
  };

  const EDIT_MODE = {
    NONE: null,
    ADD_TREE: "add_tree",
    REPORT: "report",
  };

  const [toolBarMode, setToolBarMode] = useState(TOOLBAR.LAYERS);
  const [editMode, setEditMode] = useState(EDIT_MODE.NONE);

  

  const goToLayers = () => {
    setEditMode(EDIT_MODE.NONE);
    setToolBarMode(TOOLBAR.LAYERS);
    setAddMode(false);
  };

  const goToEdit = () => {
    setEditMode(EDIT_MODE.NONE);
    setToolBarMode(TOOLBAR.EDIT);
    setAddMode(false);
  };

  const handleSaveFromForm = ({ formData, coords, photoFile }) => {
    if (!coords) {
      alert("Selecione uma localização no mapa antes de salvar.");
      return;
    }

    onSaveTree({ formData, coords, photoFile });
  };

  const handleCancelAddTree = () => {
    goToEdit();
    onCancelAdd ?.();
  };
  return (
    <div className="flex flex-col justify-between p-3 bg-gray-50 min-h-0 h-full">
      <div className=" flex gap-5 addTreeButtons-container min-h-0 h-full">
        <div className="flex gap-3 w-80">

        
        {/* TOOLBAR - NAV */}
          <Button
            variant="secondary"
            text="Camadas"
            Icon={IoLayers} // <-- Pass the imported component
            isSelected={toolBarMode === TOOLBAR.LAYERS}
            onClick={() => {
              setToolBarMode(TOOLBAR.LAYERS);
              setEditMode(EDIT_MODE.NONE);
            }}
          />
          <Button
            variant="secondary"
            text="Editar Mapa"
            Icon={BiSolidPencil} // <-- Pass the imported component
            isSelected={toolBarMode === TOOLBAR.EDIT}
            onClick={() => setToolBarMode(TOOLBAR.EDIT)}
          />
        </div>


        {/* TOOLBAR - LAYER */}
        {toolBarMode === TOOLBAR.LAYERS && (
          <div className="flex flex-col p-3 gap-3 flex-none rounded-md bg-white">
            <h1 className=" text-PrimaryLight font-bold">condições atuais</h1>
            <LayerButton
              showLayer={onShowZoneamento}
              zoneamentoVisible={zoneamentoVisible}
            />
          </div>
        )}


        {/* TOOLBAR - EDIT */}
        {toolBarMode === TOOLBAR.EDIT && (
          <div className="flex flex-col gap-5">
            <Button
              variant="secondary"
              text="Adicionar árvore"
              isSelected={true}
              // onClick={() => setShowAddOptions(true)}
              onClick={() => {
                setEditMode(EDIT_MODE.ADD_TREE);
                setAddMode(true); // <--- 3. ATIVE O MODO NO MAPA AQUI
                setToolBarMode(TOOLBAR.NONE);
              }}
            />
            <Button
              variant="secondary"
              text="relatar um problema"
              isSelected={true}
              // onClick={() => setShowAddOptions(true)}
              onClick={() => setEditMode(EDIT_MODE.REPORT)}
            />
          </div>
        )}


        {/* TOOLBAR - EDIT - ADD TREE */}
        { editMode === EDIT_MODE.ADD_TREE && (
          <AddTreeForm
            coords={pendingCoords}
            onSave={handleSaveFromForm}
            onCancel={handleCancelAddTree}
            onAddTreeAtMyLocation={handleAddTreeAtMyLocation}
          />
        )}
      </div>
    </div>
  );
}

export default Toolbar;
