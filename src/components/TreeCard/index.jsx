import "./style.css";

function TreeCard({ tree, onClose }) {
  return (
    <div className="card">
      <h3>ID #{tree.ID}</h3>
      <p>
        <strong>Tipo:</strong> {tree.TIPO_INDIVIDUO || "N/A"}
      </p>
      <p>
        <strong>Espécie:</strong> {tree.NOME_CIENTIFICO || "Desconhecida"}
      </p>
      <p>
        <strong>Nome popular:</strong> {tree.NOME_POPULAR || "Desconhecida"}
      </p>
      <p>
        <strong>Endereço:</strong> {tree.LOGRADOURO_REFERENCIA || "N/A"},{" "}
        {tree.NUMERO_REFERENCIA || "N/A"}
      </p>
      <p>
        <strong>Local de plantio:</strong> {tree.LOCAL_PLANTIO || "N/A"}
      </p>
      <p>
        <strong>Data de Levantamento:</strong> {tree.DATA_LEVANTAMENTO || "N/A"}
      </p>
      <button onClick={onClose}>Fechar</button>
    </div>
  );
}

export default TreeCard;
