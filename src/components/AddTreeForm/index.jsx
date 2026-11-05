import { useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { EditorField, EditorFooter, EditorPhoto } from "../EditorCard";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = TOKEN;

function AddTreeForm({ coords, onSave, onCancel }) {
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

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

  const handlePhotoSelect = (file) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);
    try {
      await onSave({ formData, coords, photoFile });
    } catch (err) {
      setSubmitError(
        err?.message || "Não foi possível salvar a árvore. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!coords) return;

    let active = true;
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

          const road = place.place_type.includes("address")
            ? place.text
            : context.find((c) => c.id.startsWith("street"))?.text ||
              place.text ||
              "";

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
      active = false;
    };
  }, [coords]);

  return (
    <form onSubmit={handleSubmit} className="editor-form">
      <div className="editor-body">
        <div className="editor-row editor-row-address">
          <EditorField
            id="logradouro-field"
            label="Logradouro"
            name="LOGRADOURO_REFERENCIA"
            placeholder="Rua da Bahia"
            value={formData.LOGRADOURO_REFERENCIA}
            onChange={handleChange}
            disabled={isLoadingAddress}
            loading={isLoadingAddress}
          />
          <EditorField
            id="numero-field"
            label="Número"
            name="NUMERO_REFERENCIA"
            placeholder="726"
            value={formData.NUMERO_REFERENCIA}
            onChange={handleChange}
          />
          <EditorField
            id="cep-field"
            label="CEP"
            optional
            name="CEP"
            placeholder="30160-011"
            value={formData.CEP}
            onChange={handleChange}
          />
        </div>

        <div className="editor-row editor-row-thirds">
          <EditorField
            id="name-field"
            label="Nome popular"
            optional
            name="NOME_POPULAR"
            placeholder="Ipê-amarelo"
            value={formData.NOME_POPULAR}
            onChange={handleChange}
          />
          <EditorField
            id="localPlantio"
            as="select"
            label="Local de plantio"
            optional
            name="LOCAL_PLANTIO"
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
          </EditorField>
          <EditorField
            id="class-field"
            as="select"
            label="Classificação especial"
            optional
            name="CLASS_ESPECIAL"
            value={formData.CLASS_ESPECIAL}
            onChange={handleChange}
          >
            <option value="">Nenhuma</option>
            <option value="muda">Muda</option>
            <option value="mvm">Monumento vegetal municipal</option>
            <option value="matriz">Matriz</option>
          </EditorField>
        </div>

        <div className="editor-row editor-row-detail">
          <fieldset className="editor-field">
            <legend className="editor-label">É um novo plantio?</legend>
            <div className="editor-radios">
              <label>
                <input
                  type="radio"
                  name="NOVO_PLANTIO"
                  value="yes"
                  checked={formData.NOVO_PLANTIO === "yes"}
                  onChange={handleChange}
                />
                Sim
              </label>
              <label>
                <input
                  type="radio"
                  name="NOVO_PLANTIO"
                  value="no"
                  checked={formData.NOVO_PLANTIO === "no"}
                  onChange={handleChange}
                />
                Não
              </label>
            </div>
          </fieldset>
          <EditorField
            id="padrinho-field"
            label="Padrinho / madrinha"
            optional
            name="RESPONSAVEL"
            placeholder="Nome de quem cuida da árvore"
            value={formData.RESPONSAVEL}
            onChange={handleChange}
          />
        </div>

        <EditorField
          id="obs-field"
          as="textarea"
          label="Observações"
          optional
          name="OBSERVACOES"
          rows={2}
          placeholder="Ex.: tronco com sinais de cupim, galhos baixos..."
          value={formData.OBSERVACOES}
          onChange={handleChange}
        />

        <EditorPhoto
          label="Adicionar foto da árvore"
          preview={photoPreview}
          onSelect={handlePhotoSelect}
          onRemove={handleRemovePhoto}
        />

        {submitError && (
          <p role="alert" className="editor-alert">
            {submitError}
          </p>
        )}
      </div>
      <EditorFooter
        onCancel={() => {
          if (!isSubmitting) onCancel();
        }}
        submitLabel={isSubmitting ? "Salvando…" : "Salvar árvore"}
        submitDisabled={isSubmitting}
      />
    </form>
  );
}

export default AddTreeForm;
