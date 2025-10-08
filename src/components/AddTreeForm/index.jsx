import { useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "./style.css";

function AddTreeForm({ coords, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    NOME_POPULAR: "",
    LOCAL_PLANTIO: "",
    LOGRADOURO_REFERENCIA: "",
    NUMERO_REFERENCIA: "",
    CEP: "",
    OBSERVACOES: "",
  });

  const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
  mapboxgl.accessToken = TOKEN;

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
        OBSERVACOES: formData.OBSERVACOES || "",
        CEP: formData.CEP || "",
        DATA_LEVANTAMENTO: new Date().toLocaleString(),
        ORGAO_LEVANTAMENTO: "Usuário",
      },
    };

    onSave(newTree);
  };

  // 🔹 Reverse geocoding ao receber coords
  useEffect(() => {
    if (!coords) return;

    const fetchAddressFromCoords = async ([lng, lat]) => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${TOKEN}`
        );
        const data = await res.json();

        if (data.features && data.features.length > 0) {
          const place = data.features[0];
          const context = place.context || [];

          const road = place.place_type.includes("address")
            ? place.text
            : context.find((c) => c.id.startsWith("street"))?.text || "";

          const houseNumber =
            place.place_type.includes("address") && place.address
              ? place.address
              : "";

          const postcode =
            context.find((c) => c.id.startsWith("postcode"))?.text || "";

          setFormData((prev) => ({
            ...prev,
            LOGRADOURO_REFERENCIA: road,
            NUMERO_REFERENCIA: houseNumber,
            CEP: postcode,
          }));
        }
      } catch (err) {
        console.error("Erro ao buscar endereço:", err);
      }
    };

    fetchAddressFromCoords(coords);
  }, [coords, TOKEN]);

  return (
    <div>
      <h3>Nova árvore</h3>
      <form onSubmit={handleSubmit} className="form-container">
        <div>
          <label htmlFor="nomePop">Nome Popular</label>
          <span> opcional</span>
        </div>
        <input
          name="NOME_POPULAR"
          placeholder="Ex: Ipê Amarelo"
          id="nomePop"
          value={formData.NOME_POPULAR}
          onChange={handleChange}
        />

        <div>
          <label>Endereço de referência</label>
        </div>
        <label htmlFor="localPlantio">Local de plantio</label>
        <select
          id="localPlantio"
          name="LOCAL_PLANTIO"
          value={formData.LOCAL_PLANTIO}
          onChange={handleChange}
        >
          <option value="">Selecione um local</option>
          <option value="calçada">Calçada</option>
          <option value="praça">Praça</option>
          <option value="canteiro central">Canteiro central</option>
          <option value="parque">Parque</option>
          <option value="interna ao lote">Interna ao Lote</option>
          <option value="faixa de rolamento">Faixa de Rolamento</option>
        </select>
        <input
          name="LOGRADOURO_REFERENCIA"
          placeholder="Logradouro"
          value={formData.LOGRADOURO_REFERENCIA}
          onChange={handleChange}
        />
        <input
          name="NUMERO_REFERENCIA"
          placeholder="Número"
          value={formData.NUMERO_REFERENCIA}
          onChange={handleChange}
        />
        <input
          name="CEP"
          placeholder="CEP"
          value={formData.CEP}
          onChange={handleChange}
        />

        <div>
          <label htmlFor="observ">Observações</label>
          <span> opcional</span>
        </div>
        <input
          name="OBSERVACOES"
          placeholder="estado da árvore ou detalhes importantes"
          id="observ"
          value={formData.OBSERVACOES}
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
