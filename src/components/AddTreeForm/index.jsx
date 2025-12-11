import { useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "./style.css";
import InputField from "../InputField";

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
    <div className=" flex flex-col h-full bg-amber-200">
      <h3>incluir uma nova árvore</h3>
      <form onSubmit={handleSubmit} className="flex flex-col h-full justify-between ">
        <div className="overflow-y-scroll flex-1 grow">
          <div className="bg-white p-2 flex flex-col gap-7 rounded-md ">
            <div><h2 className="text-xl font-semibold">identificação</h2>
              <hr className=" border-gray-200 border-1 " /></div>

            <InputField
              id="name-field"
              label="nome popular"
              name="nomePopular"
              type="text"
              IsOpcional={true}
              placeholder=""
              value={formData.nomePopular}
              onChange={handleChange}
            />
            <div><label htmlFor="classEspecial" className=' font-semibold text-gray-500' >classificação especial</label> <span className="text-gray-400 text-sm"> opcional</span>
              <select
                id="class-field"
                name="classEspecial"
                className="bg-gray-100 p-2  text-gray-900 border-1 pl-3  border-gray-300 rounded-md w-full"
                value={formData.classEspecial}
                onChange={handleChange}

              >
                <option value=""> </option>
                <option value="muda">Muda</option>
                <option value="mvm">Monumento vegetal municipal</option>
                <option value="matriz">Matriz</option>
              </select></div>

          </div>
          <div className="bg-white p-2 flex flex-col gap-5 rounded-md ">
            <div><h2 className="text-xl font-semibold">endereço de referência</h2>
              <hr className=" border-gray-200 border-1 " /></div>

            <InputField
              id="logradouro-field"
              label="logradouro"
              name="LOGRADOURO_REFERENCIA"
              type="text"
              IsOpcional={false}
              placeholder=""
              value={formData.LOGRADOURO_REFERENCIA}
              onChange={handleChange}
            />

            <div className="flex flex-row gap-10">
              <InputField
                id="numero-field"
                label="número"
                name="NUMERO_REFERENCIA"
                type="text"
                IsOpcional={false}
                placeholder=""
                value={formData.NUMERO_REFERENCIA}
                onChange={handleChange}
              />

              <InputField
                id="cep-field"
                label="CEP"
                name="CEP"
                type="text"
                IsOpcional={true}
                placeholder=""
                value={formData.CEP}
                onChange={handleChange}
              />
            </div>
            <div><label htmlFor="localPlantio" className=' font-semibold text-gray-500'>Local de plantio</label> <span className="text-gray-400 text-sm"> opcional</span>
              <select
                id="localPlantio"
                name="LOCAL_PLANTIO"
                className="bg-gray-100 p-2  text-gray-900 border-1 pl-3  border-gray-300 rounded-md w-full"
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
              </select></div>
          </div>

          <div className="h-160 bg-black">
            <InputField
              id="obs-field"
              label="Observações"
              name="OBSERVACOES"
              type="text"
              IsOpcional={true}
              placeholder=""
              value={formData.OBSERVACOES}
              onChange={handleChange}
            />
          </div>
        </div>
        <div className="bg-yellow-800 flex-none">
          <button type="submit">Salvar</button>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddTreeForm;
