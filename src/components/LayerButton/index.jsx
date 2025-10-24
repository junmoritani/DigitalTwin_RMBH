import "./style.css";

function LayerButton({ showLayer, zoneamentoVisible }) {
  return (
    <div className=" ">
      
      <button
        className={` p-3 gap-5 flex w-full h-full rounded-md hover:bg-gray-100 ${zoneamentoVisible ? "bg-gray-200" : ""}`}
        onClick={() => showLayer(true)}
      >
        <div className="w-6 h-6 rounded-md bg-gray-300"></div>
        Zoneamento
      </button>
    </div>
  );
}

export default LayerButton;
