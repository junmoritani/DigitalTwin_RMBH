import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "./style.css";
import InputField from "../InputField";
import Button from "../Button";
import { MdPhotoCamera, MdDelete } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = TOKEN;

function AddTreeForm({ coords,  onUpdateCoords, onSave, onCancel, onAddTreeAtMyLocation }) {
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // States para a Foto
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null); // Referência para o input invisível

  const [formData, setFormData] = useState({
    NOME_POPULAR: "",
    LOCAL_PLANTIO: "",
    LOGRADOURO_REFERENCIA: "",
    NUMERO_REFERENCIA: "",
    CEP: "",
    OBSERVACOES: "",
    CLASS_ESPECIAL: "",
    NOVO_PLANTIO: "no",
    RESPONSAVEL: "",
  });

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    
  // ==================== FOTO ====================
  // Lógica de Captura
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      // Cria uma URL temporária para mostrar o preview sem upload
      const objectUrl = URL.createObjectURL(file);
      setPhotoPreview(objectUrl);
    }
  };

  // Lógica de Remoção
  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    // Limpa o input para permitir selecionar a mesma foto novamente se quiser
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Limpeza de Memória (Evita Memory Leak do ObjectURL)
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  // Função auxiliar para disparar o input oculto
  const triggerCamera = () => {
    fileInputRef.current.click();
  };

// ==================== SUBMIT FORM ====================
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ formData, coords, photoFile });
  };


// ==================== FETCH ADRESS FROM COORDS WITH LOADING ====================
  // Reverse geocoding com Loading State e Race Condition Protection
  useEffect(() => {
    if (!coords) return;

    let active = true; // Flag para evitar condições de corrida
    setIsLoadingAddress(true);

    const fetchAddressFromCoords = async ([lng, lat]) => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${TOKEN}`
        );
        const data = await res.json();

        if (active && data.features && data.features.length > 0) {
          const place = data.features[0];
          const context = place.context || [];

          // Lógica refinada para extração
          const road = place.place_type.includes("address")
            ? place.text
            : context.find((c) => c.id.startsWith("street"))?.text ||
              place.text ||
              ""; // Fallback para o nome do lugar se não achar rua

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
      } finally {
        if (active) setIsLoadingAddress(false);
      }
    };

    fetchAddressFromCoords(coords);

    return () => {
      active = false; // Cleanup
    };
  }, [coords]);


  const fetchCoordsFromAddress = async () => {
    const { LOGRADOURO_REFERENCIA, NUMERO_REFERENCIA, CEP } = formData;
    if (!LOGRADOURO_REFERENCIA) return;
  
    const query = encodeURIComponent(
      `${LOGRADOURO_REFERENCIA} ${NUMERO_REFERENCIA || ""} ${CEP || ""}`
    );
  
    try {
      setIsLoadingAddress(true);
  
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?` +
        `access_token=${TOKEN}&country=BR&limit=1`
      );
  
      const data = await res.json();
  
      if (data.features?.length) {
        const [lng, lat] = data.features[0].center;
  
        // 🔥 MOVE O PONTO NO MAPA
        onUpdateCoords([lng, lat]);
      }
    } catch (e) {
      console.error("Erro no forward geocoding:", e);
    } finally {
      setIsLoadingAddress(false);
    }
  };


  return (
    <div className=" flex flex-col h-full min-h-0 bg-gray-50">
      <h3 className="flex-none p-5 text-lg uppercase font-normal text-gray-800">
        incluir uma nova árvore
      </h3>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col flex-1 min-h-0 justify-between "
      >
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0  p-3">

          {/* GRUPO ENDEREÇO */}
          <div className="bg-white p-2 flex flex-col gap-5 rounded-md ">
            <div>
              <h2 className="text-xl font-semibold">endereço de referência</h2>
              <hr className=" border-gray-200 border-1 " />
            </div>
            <Button
              variant="secondary"
              text="Usar minha localização atual"
              isSelected={true}
              onClick={(e) => {
                e.preventDefault(); // Importante para não submeter o form
                onAddTreeAtMyLocation();
              }}
            />
            {/* Feedback visual de loading */}
            {isLoadingAddress && (
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                <AiOutlineLoading3Quarters className="animate-spin" />
                Buscando endereço exato...
              </div>
            )}

            <InputField
              id="logradouro-field"
              label="logradouro"
              name="LOGRADOURO_REFERENCIA"
              type="text"
              IsOpcional={false}
              placeholder=""
              value={formData.LOGRADOURO_REFERENCIA}
              onChange={handleChange}
              disabled={isLoadingAddress} // UX: Evita edição durante fetch
            />

            <div className="flex flex-row gap-10">
              <div className="w-1/3">
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
              </div>
              <div className="w-2/3">
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
            </div>
            <Button
  variant="secondary"
  type="button"
  text="Localizar no mapa"
  onClick={fetchCoordsFromAddress}
/>

            <div>
              <label
                htmlFor="localPlantio"
                className=" font-semibold text-gray-500"
              >
                Local de plantio
              </label>
              <span className="text-gray-400 text-sm"> opcional</span>
              <select
                id="localPlantio"
                name="LOCAL_PLANTIO"
                className="w-full bg-gray-50 text-gray-900 border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white 
                resize-none transition-all"
                value={formData.LOCAL_PLANTIO}
                onChange={handleChange}
              >
                <option value="">Selecione...</option>
                <option value="calçada">Calçada</option>
                <option value="praça">Praça</option>
                <option value="canteiro central">Canteiro central</option>
                <option value="parque">Parque</option>
                <option value="interna ao lote">Interna ao Lote</option>
                <option value="faixa de rolamento">Faixa de Rolamento</option>
              </select>
            </div>
          </div>

          {/* GRUPO IDENTIFICAÇÃO */}
          <div className="bg-white p-2 flex flex-col gap-7 rounded-md ">
            <div>
              <h2 className="text-xl font-semibold">identificação</h2>
              <hr className=" border-gray-200 border-1 " />
            </div>

            <InputField
              id="name-field"
              label="nome popular"
              name="NOME_POPULAR"
              type="text"
              IsOpcional={true}
              placeholder=""
              value={formData.NOME_POPULAR}
              onChange={handleChange}
            />
            <div>
              <label
                htmlFor="class-field"
                className="font-semibold text-gray-500"
              >
                classificação especial
              </label>
              <span className="text-gray-400 text-sm"> opcional</span>
              <select
                id="class-field"
                name="CLASS_ESPECIAL"
                className="w-full bg-gray-50 text-gray-900 border border-gray-300 rounded-md p-2.5 focus:border-blue-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white 
                resize-none transition-all"
                value={formData.CLASS_ESPECIAL}
                onChange={handleChange}
              >
                <option value="">Nenhuma</option>
                <option value="muda">Muda</option>
                <option value="mvm">Monumento vegetal municipal</option>
                <option value="matriz">Matriz</option>
              </select>
            </div>
          </div>

          {/* GRUPO DETALHES */}
          <div className="bg-white p-2 flex flex-col gap-5 rounded-md ">
            <div>
              <h2 className="text-xl font-semibold tracking-wide">detalhes</h2>
              <hr className=" border-gray-200 border-1 " />
            </div>
            <div className="flex flex-col ">
              <label className="font-semibold text-gray-500">
                É um novo plantio?
              </label>

              <div className="flex gap-4">
                {/* Option: YES */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="NOVO_PLANTIO" // Must match for both
                    value="yes"
                    checked={formData.NOVO_PLANTIO === "yes"}
                    onChange={handleChange}
                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                  />
                  <span>Sim</span>
                </label>

                {/* Option: NO */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="NOVO_PLANTIO" // Must match for both
                    value="no"
                    checked={formData.NOVO_PLANTIO === "no"}
                    onChange={handleChange}
                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500 "
                  />
                  <span>Não</span>
                </label>
              </div>
            </div>
            <InputField
              id="padrinho-field"
              label="padrinho / madrinha"
              name="RESPONSAVEL"
              type="text"
              IsOpcional={true}
              value={formData.RESPONSAVEL}
              onChange={handleChange}
            />
            <div>
              <label
                htmlFor="obs-field"
                className="font-semibold text-gray-500"
              >
                observações
              </label>
              <span className="text-gray-400 text-sm"> opcional</span>
              <textarea
                id="obs-field"
                className="w-full bg-gray-100 p-2 border border-gray-300 rounded-md 
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white 
              resize-none transition-all"
                placeholder="Ex: Tronco com sinais de cupim, galhos baixos..."
                rows="3"
                name="OBSERVACOES" // Must match for both
                value={formData.OBSERVACOES}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* ÁREA DA FOTO (NOVA) */}
          <div className="bg-white p-4 flex flex-col gap-4 rounded-lg shadow-sm border border-gray-100">
            <div>
              <h2 className="text-xl font-semibold tracking-wide ">
                registro fotográfico
              </h2>
              <hr className=" border-gray-200 border-1 " />
            </div>

            {/* Input Invisível */}
            <input
              type="file"
              accept="image/*"
              capture="environment" // 💡 Isso força a câmera traseira no celular
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              className="hidden" // Esconde o input feio padrão
            />

            {/* Preview Area */}
            {photoPreview ? (
              <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
                <img
                  src={photoPreview}
                  alt="Preview da árvore"
                  className="w-full h-full object-cover"
                />

                {/* Overlay com botão de deletar */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition"
                    title="Remover foto"
                  >
                    <MdDelete size={24} />
                  </button>
                </div>
                {/* Botão flutuante para mobile (sempre visível) */}
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 bg-white/80 p-1 rounded-full text-red-600 shadow-sm md:hidden"
                >
                  <MdDelete size={20} />
                </button>
              </div>
            ) : (
              <div
                onClick={triggerCamera}
                className="border-2 border-dashed border-gray-300 rounded-lg h-32 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer"
              >
                <MdPhotoCamera size={32} />
                <span className="text-sm mt-1">Toque para adicionar foto</span>
              </div>
            )}
            <div className="w-full flex flex-col ">
              {/* Botão Principal de Câmera (só aparece se não tiver foto ainda, opcional) */}
              {!photoPreview && (
                <Button
                  variant="complementary"
                  text="Tirar Foto"
                  Icon={MdPhotoCamera}
                  type="button"
                  onClick={triggerCamera}
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex-none ">
          <div className="grid grid-cols-2 gap-3 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <Button
              variant="secondary"
              text="cancelar"
              isSelected={true}
              onClick={onCancel}
            />
            <Button variant="primary" text="Salvar Árvore" type="submit" />
          </div>
        </div>
      </form>
    </div>
  );
}

export default AddTreeForm;
