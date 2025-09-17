function AddTreeButton({ addMode, setAddMode }) {
  return (
    <button
      onClick={() => setAddMode(true)}
      style={{ background: addMode ? "#f56565" : "#3182ce" }}
    >
      {addMode ? "Clique no mapa..." : "Adicionar árvore"}
    </button>
  );
}

export default AddTreeButton;
