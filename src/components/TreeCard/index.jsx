import { useState } from "react";
import "./style.css";
import StreetViewImage from "../StreetViewImage";

function TreeCard({ tree, onClose, onDelete }) {
  const [showReportOptions, setShowReportOptions] = useState(false);

  return (
    <div className="card">
      <h3>ID #{tree.ID}</h3>
      <StreetViewImage
        location="40.689247,-74.044502"
        heading={151}
        fov={110}
      />
      <div>
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
          <strong>Data de Levantamento:</strong>{" "}
          {tree.DATA_LEVANTAMENTO || "N/A"}
        </p>
      </div>
      <div className="report">
        {!showReportOptions ? (
          <button onClick={() => setShowReportOptions(true)}>
            Reportar um problema
          </button>
        ) : (
          <div className="report-options">
            <p>
              <strong>Qual problema deseja reportar?</strong>
            </p>

            <button onClick={() => onDelete(tree.ID)} style={{ color: "red" }}>
              Essa árvore não existe mais
            </button>
            <button onClick={() => alert("Função ainda não implementada")}>
              Precisa de manutenção
            </button>
            <button onClick={() => alert("Função ainda não implementada")}>
              Informações incorretas
            </button>
            <button onClick={() => setShowReportOptions(false)}>
              Cancelar
            </button>
          </div>
        )}
      </div>
      <button onClick={onClose}>Fechar</button>
    </div>
  );
}

export default TreeCard;
