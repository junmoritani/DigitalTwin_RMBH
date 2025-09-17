import { useState } from "react";
import "./style.css";

function AddTreeForm({ coords, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    NOME_CIENTIFICO: "",
    NOME_POPULAR: "",
    LOCAL_PLANTIO: "",
    LOGRADOURO_REFERENCIA: "",
    NUMERO_REFERENCIA: "",
  });

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();

    const newTree = {
      type: "Feature",
      geometry: { type: "Point", coordinates: coords },
      properties: {
        ID: Date.now(),
        ID_ARVORE_SIIA: null,
        TIPO_INDIVIDUO: "Árvore",
        LOCAL_PLANTIO: formData.LOCAL_PLANTIO || "Desconhecido",
        LOGRADOURO_REFERENCIA: formData.LOGRADOURO_REFERENCIA || "Novo",
        NUMERO_REFERENCIA: formData.NUMERO_REFERENCIA || "",
        LOCAL_REFERENCIA: null,
        NOME_CIENTIFICO: formData.NOME_CIENTIFICO || "Desconhecido",
        NOME_POPULAR: formData.NOME_POPULAR || "Nova árvore",
        DATA_LEVANTAMENTO: new Date().toLocaleString(),
        ORGAO_LEVANTAMENTO: "Usuário",
      },
    };

    onSave(newTree);
  };

  return (
    <div>
      <h3>Nova árvore</h3>
      <form onSubmit={handleSubmit} className="form-container">
        <input
          name="NOME_CIENTIFICO"
          placeholder="Nome científico"
          onChange={handleChange}
        />
        <input
          name="NOME_POPULAR"
          placeholder="Nome popular"
          onChange={handleChange}
        />
        <input
          name="LOCAL_PLANTIO"
          placeholder="Local de plantio"
          onChange={handleChange}
        />
        <input
          name="LOGRADOURO_REFERENCIA"
          placeholder="Logradouro"
          onChange={handleChange}
        />
        <input
          name="NUMERO_REFERENCIA"
          placeholder="Número"
          onChange={handleChange}
        />
        <button type="submit">Salvar</button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </form>
    </div>
  );
}

export default AddTreeForm;
