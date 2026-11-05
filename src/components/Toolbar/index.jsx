import { useEffect, useRef, useState } from "react";
import AddTreeForm from "../AddTreeForm";
import EditorCard, { EditorField, EditorFooter, EditorPhoto } from "../EditorCard";
import LayerButton from "../LayerButton";
import { IoClose, IoLayers } from "react-icons/io5";
import { BiSolidPencil } from "react-icons/bi";
import { MdAddLocationAlt, MdOutlineReportProblem, MdPark } from "react-icons/md";
import { formatTrees } from "../../map/bairroDensity";
import { HAND_ICON, PLANT_ICON, REPORT_ICON } from "../../map/layers";

function DialogueSwatch({ tone }) {
  const report = tone === "report";
  const fill = report ? "#d67d00" : "#254f1f";
  if (report) {
    return (
      <svg width="22" height="19" viewBox="0 0 21.49 18.61" aria-hidden="true">
        <path d={REPORT_ICON} fill={fill} />
      </svg>
    );
  }
  return (
    <svg width="20" height="22" viewBox="0 0 80 90" aria-hidden="true">
      <svg x="20.06" y="0" width="47.53" height="65.27" viewBox="10.51 0 45.68 65.27">
        <path d={PLANT_ICON} fill={fill} />
      </svg>
      <svg x="0" y="56.06" width="80" height="33.94" viewBox="0 0 76.88 33.94">
        <path d={HAND_ICON} fill={fill} />
      </svg>
    </svg>
  );
}

function Toolbar({
  pendingCoords,
  onSaveTree,
  onCancelAdd,
  onTreesChange,
  treesVisible,
  onReportsChange,
  reportsVisible = true,
  onPlantingsChange,
  plantingsVisible = true,
  densityMode,
  bairroMetric = "DENSITY",
  onBairroMetricChange,
  treeColorMode = "default",
  onTreeColorModeChange,
  speciesFilter = "",
  onSpeciesFilterChange,
  viewportSpecies = [],
  pointLegend = [],
  handleAddTreeAtMyLocation,
  setAddMode,
  user,
  onRequestAuth,
  setPlantingMode,
  plantingCoords,
  onSavePlanting,
  onCancelPlanting,
  onPlantingAtMyLocation,
  setReportMode,
  reportCoords,
  reportTree,
  onSaveProblem,
  onCancelProblem,
  onReportAtMyLocation,
  onEditorChange,
  mobilePane = null,
  onRequestMap,
}) {
  const TOOLBAR = {
    LAYERS: "layers",
    EDIT: "edit",
  };

  const EDIT_MODE = {
    NONE: null,
    ADD_TREE: "add_tree",
    SUGGEST_PLANTING: "suggest_planting",
    REPORT: "report",
  };

  const [toolBarMode, setToolBarMode] = useState(TOOLBAR.LAYERS);
  const [editMode, setEditMode] = useState(EDIT_MODE.NONE);
  const [locationError, setLocationError] = useState(false);
  const layersTabRef = useRef(null);
  const editTabRef = useRef(null);

  useEffect(() => {
    if (pendingCoords) setLocationError(false);
  }, [pendingCoords]);

  useEffect(() => {
    onEditorChange?.(editMode != null);
  }, [editMode, onEditorChange]);

  const leaveAddMode = () => {
    setEditMode(EDIT_MODE.NONE);
    setAddMode(false);
    setLocationError(false);
    onCancelAdd?.();
  };

  const selectLayers = () => {
    setToolBarMode(TOOLBAR.LAYERS);
    if (editMode === EDIT_MODE.ADD_TREE) {
      leaveAddMode();
      return;
    }
    if (editMode === EDIT_MODE.SUGGEST_PLANTING) {
      leaveSuggestPlanting();
      return;
    }
    if (editMode === EDIT_MODE.REPORT) {
      leaveReport();
      return;
    }
    setAddMode(false);
    setPlantingMode(false);
    setReportMode(false);
  };

  const selectEdit = () => {
    setToolBarMode(TOOLBAR.EDIT);
    if (editMode === EDIT_MODE.ADD_TREE) setAddMode(true);
    if (editMode === EDIT_MODE.SUGGEST_PLANTING) setPlantingMode(true);
    if (editMode === EDIT_MODE.REPORT) setReportMode(true);
  };

  useEffect(() => {
    if (mobilePane === "layers") selectLayers();
    if (mobilePane === "edit") {
      setToolBarMode(TOOLBAR.EDIT);
      if (editMode === EDIT_MODE.ADD_TREE) leaveAddMode();
      else if (editMode === EDIT_MODE.SUGGEST_PLANTING) leaveSuggestPlanting();
      else if (editMode === EDIT_MODE.REPORT) leaveReport();
    }
  }, [mobilePane]);

  const onTabKeyDown = (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    if (toolBarMode === TOOLBAR.LAYERS) {
      selectEdit();
      editTabRef.current?.focus();
    } else {
      selectLayers();
      layersTabRef.current?.focus();
    }
  };

  const startAddTree = () => {
    if (!user) {
      onRequestAuth?.(
        "login",
        "Entre na sua conta ou crie um cadastro gratuito para adicionar árvores ao inventário."
      );
      return;
    }
    setLocationError(false);
    setEditMode(EDIT_MODE.ADD_TREE);
    setPlantingMode(false);
    onCancelPlanting?.();
    setReportMode(false);
    onCancelProblem?.();
    setAddMode(true);
    onRequestMap?.();
  };

  const leaveSuggestPlanting = () => {
    setEditMode(EDIT_MODE.NONE);
    setPlantingMode(false);
    onCancelPlanting?.();
  };

  const startSuggestPlanting = () => {
    if (!user) {
      onRequestAuth?.(
        "login",
        "Entre na sua conta para indicar um local onde uma árvore pode ser plantada."
      );
      return;
    }
    setAddMode(false);
    onCancelAdd?.();
    setReportMode(false);
    onCancelProblem?.();
    setEditMode(EDIT_MODE.SUGGEST_PLANTING);
    setPlantingMode(true);
    onRequestMap?.();
  };

  const leaveReport = () => {
    setEditMode(EDIT_MODE.NONE);
    setReportMode(false);
    onCancelProblem?.();
  };

  const startReport = () => {
    if (!user) {
      onRequestAuth?.(
        "login",
        "Entre na sua conta para relatar um problema no inventário."
      );
      return;
    }
    setAddMode(false);
    onCancelAdd?.();
    setPlantingMode(false);
    onCancelPlanting?.();
    setEditMode(EDIT_MODE.REPORT);
    setReportMode(true);
    onRequestMap?.();
  };

  const handleSaveFromForm = async ({ formData, coords, photoFile }) => {
    if (!coords) {
      setLocationError(true);
      throw new Error("Escolha um ponto no mapa antes de salvar.");
    }

    await onSaveTree({ formData, coords, photoFile });
    setEditMode(EDIT_MODE.NONE);
    setLocationError(false);
  };

  const tabClass = (selected) =>
    `flex cursor-pointer items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-PrimaryLight ${
      selected
        ? "bg-white text-PrimaryDark shadow-sm"
        : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <>
    <aside
      className={`flex min-h-0 w-80 shrink-0 flex-col self-stretch overflow-hidden border-r border-gray-200 bg-gray-50 max-md:w-full max-md:border-r-0 max-md:pb-24 ${
        mobilePane === "map" ? "max-md:hidden" : ""
      }`}
      aria-label="Ferramentas do mapa"
    >
      <div className="shrink-0 p-3 pb-2 max-md:hidden">
        <div
          role="tablist"
          aria-label="Modo do painel"
          className="grid grid-cols-2 gap-1 rounded-xl bg-gray-200/80 p-1"
          onKeyDown={onTabKeyDown}
        >
          <button
            type="button"
            role="tab"
            id="tab-layers"
            ref={layersTabRef}
            aria-controls="panel-layers"
            aria-selected={toolBarMode === TOOLBAR.LAYERS}
            tabIndex={toolBarMode === TOOLBAR.LAYERS ? 0 : -1}
            className={tabClass(toolBarMode === TOOLBAR.LAYERS)}
            onClick={selectLayers}
          >
            <IoLayers className="h-4 w-4" aria-hidden="true" />
            Camadas
          </button>
          <button
            type="button"
            role="tab"
            id="tab-edit"
            ref={editTabRef}
            aria-controls="panel-edit"
            aria-selected={toolBarMode === TOOLBAR.EDIT}
            tabIndex={toolBarMode === TOOLBAR.EDIT ? 0 : -1}
            className={tabClass(toolBarMode === TOOLBAR.EDIT)}
            onClick={selectEdit}
          >
            <BiSolidPencil className="h-4 w-4" aria-hidden="true" />
            Editar mapa
          </button>
        </div>
      </div>

      {toolBarMode === TOOLBAR.LAYERS && (
        <div
          role="tabpanel"
          id="panel-layers"
          aria-labelledby="tab-layers"
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4 max-md:px-4 max-md:pt-4"
        >
          <h1 className="hidden px-1 text-[1.75rem] font-bold text-gray-900 max-md:block">
            Camadas
          </h1>
          <p className="px-1 text-sm leading-snug text-gray-500">
            Escolha o que aparece no mapa e explore indicadores da arborização.
          </p>
          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-semibold text-gray-500">
              Condições atuais
            </h2>
            <LayerButton
              label="Árvores"
              description="Cada árvore cadastrada como um ponto."
              checked={treesVisible}
              onChange={onTreesChange}
              swatch={
                <span className="h-3.5 w-3.5 rounded-full bg-[#38a169] ring-2 ring-white shadow-sm" />
              }
            />
            <LayerButton
              label="Relatos"
              description="Problemas relatados no inventário."
              checked={reportsVisible}
              onChange={onReportsChange}
              swatch={<DialogueSwatch tone="report" />}
            />
            <LayerButton
              label="Sugestão de Plantios"
              description="Locais sugeridos para novos plantios."
              checked={plantingsVisible}
              onChange={onPlantingsChange}
              swatch={<DialogueSwatch tone="planting" />}
            />
          </section>

          {densityMode ? (
            <section className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-xs">
              <div>
                <h2 className="text-xs font-semibold text-gray-800">
                  Análise por bairro (visão macro)
                </h2>
                <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                  Neste zoom o mapa resume o inventário por bairro. Escolha o
                  indicador para colorir os polígonos:
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  {
                    key: "DENSITY",
                    label: "Densidade arbórea (árvores/km²)",
                    desc: "Árvores por área urbana útil do bairro.",
                  },
                  {
                    key: "SPECIES_COUNT",
                    label: "Riqueza de espécies",
                    desc: "Quantidade de espécies populares distintas.",
                  },
                  {
                    key: "MONOCULTURE",
                    label: "Concentração / Monocultura (%)",
                    desc: "Participação da espécie mais frequente no bairro.",
                  },
                ].map((option) => {
                  const active = bairroMetric === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => onBairroMetricChange?.(option.key)}
                      className={`flex cursor-pointer flex-col rounded-lg border px-2.5 py-2 text-left transition ${
                        active
                          ? "border-PrimaryLight bg-PrimaryLight/10 text-PrimaryDark"
                          : "border-gray-200 bg-gray-50/70 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-xs font-semibold">
                        {option.label}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {option.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            treesVisible && (
              <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-xs">
                <div>
                  <label
                    htmlFor="tree-color-mode"
                    className="block text-xs font-semibold text-gray-800"
                  >
                    Colorir árvores por
                  </label>
                  <select
                    id="tree-color-mode"
                    value={treeColorMode}
                    onChange={(e) => onTreeColorModeChange?.(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-800 focus:border-PrimaryLight focus:bg-white focus:outline-none focus:ring-2 focus:ring-PrimaryLight/30"
                  >
                    <option value="default">Padrão (verde uniforme)</option>
                    <option value="species">
                      Espécies mais comuns na área visível
                    </option>
                    <option value="planting">
                      Local de plantio (calçada, canteiro, praça)
                    </option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="species-filter-select"
                      className="block text-xs font-semibold text-gray-800"
                    >
                      Filtrar por espécie
                    </label>
                    {speciesFilter && (
                      <button
                        type="button"
                        onClick={() => onSpeciesFilterChange?.("")}
                        className="inline-flex cursor-pointer items-center gap-0.5 text-[11px] font-semibold text-PrimaryLight hover:underline"
                      >
                        <IoClose className="h-3.5 w-3.5" />
                        Limpar
                      </button>
                    )}
                  </div>
                  <select
                    id="species-filter-select"
                    value={speciesFilter}
                    onChange={(e) => onSpeciesFilterChange?.(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800 focus:border-PrimaryLight focus:bg-white focus:outline-none focus:ring-2 focus:ring-PrimaryLight/30"
                  >
                    <option value="">
                      Todas as espécies na tela ({viewportSpecies.length})
                    </option>
                    {viewportSpecies.slice(0, 35).map((sp) => (
                      <option key={sp.key} value={sp.label}>
                        {sp.label} ({formatTrees(sp.count)})
                      </option>
                    ))}
                  </select>
                </div>

                {pointLegend.length > 0 && (
                  <div className="border-t border-gray-100 pt-2">
                    <p className="mb-1.5 text-[11px] font-semibold text-gray-500">
                      Legenda na área visível
                    </p>
                    <ul className="space-y-1">
                      {pointLegend.map((item) => (
                        <li
                          key={item.label}
                          className="flex items-center justify-between gap-2 text-xs text-gray-700"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                              style={{ backgroundColor: item.color }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  treeColorMode === "species" &&
                                  item.label !== "Outras espécies" &&
                                  item.label !== "Sem identificação"
                                ) {
                                  onSpeciesFilterChange?.(
                                    speciesFilter === item.label
                                      ? ""
                                      : item.label
                                  );
                                }
                              }}
                              className="truncate text-left hover:underline"
                            >
                              {item.label}
                            </button>
                          </span>
                          {item.count != null && (
                            <span className="shrink-0 text-[11px] font-medium text-gray-400">
                              {formatTrees(item.count)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )
          )}
        </div>
      )}

      {toolBarMode === TOOLBAR.EDIT && (
        <div
          role="tabpanel"
          id="panel-edit"
          aria-labelledby="tab-edit"
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4 max-md:px-4 max-md:pt-4"
        >
          <h1 className="hidden px-1 text-[1.75rem] font-bold text-gray-900 max-md:block">
            Editar mapa
          </h1>
          <p className="px-1 text-sm leading-snug text-gray-500">
            Altere o mapa sem sair da visualização.
          </p>
          {!user && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
              <p className="font-semibold">Acesso colaborativo</p>
              <p className="mt-0.5 text-amber-900/80">
                Faça login para registrar novas árvores, indicar locais de plantio
                ou reportar problemas no inventário.
              </p>
              <button
                type="button"
                onClick={() => onRequestAuth?.("login")}
                className="mt-2 cursor-pointer rounded-lg bg-PrimaryDark px-3 py-1.5 text-xs font-semibold text-white hover:bg-PrimaryLight"
              >
                Entrar ou criar conta
              </button>
            </div>
          )}
          <EditAction
            icon={MdAddLocationAlt}
            title="Adicionar árvore"
            description="Marque um ponto no mapa e preencha os dados."
            onClick={startAddTree}
            active={editMode === EDIT_MODE.ADD_TREE}
          />
          <EditAction
            icon={MdPark}
            title="Indicar local de plantio"
            description="Marque onde uma árvore nova poderia ser plantada, para as equipes avaliarem."
            onClick={startSuggestPlanting}
            active={editMode === EDIT_MODE.SUGGEST_PLANTING}
          />
          <EditAction
            icon={MdOutlineReportProblem}
            title="Relatar um problema"
            description="Marque o lugar, informe o endereço e, se quiser, envie uma foto do problema."
            onClick={startReport}
            active={editMode === EDIT_MODE.REPORT}
          />
        </div>
      )}

    </aside>
    {editMode === EDIT_MODE.SUGGEST_PLANTING && (
      <SuggestPlantingPanel
        coords={plantingCoords}
        onSave={onSavePlanting}
        onCancel={leaveSuggestPlanting}
        onUseMyLocation={onPlantingAtMyLocation}
      />
    )}

    {editMode === EDIT_MODE.REPORT && (
      <ReportProblemPanel
        coords={reportCoords}
        linkedTree={reportTree}
        onSave={onSaveProblem}
        onCancel={leaveReport}
        onUseMyLocation={onReportAtMyLocation}
      />
    )}

    {editMode === EDIT_MODE.ADD_TREE && (
      <EditorCard
        title="Nova árvore"
        hint={
          pendingCoords
            ? "Clique no mapa para ajustar o ponto."
            : locationError
              ? "Escolha um ponto no mapa antes de salvar."
              : "Clique em um ponto do mapa para definir onde a árvore está."
        }
        hintTone={pendingCoords ? "success" : locationError ? "warning" : "default"}
        onDismiss={leaveAddMode}
        onUseMyLocation={handleAddTreeAtMyLocation}
      >
        <AddTreeForm
          coords={pendingCoords}
          onSave={handleSaveFromForm}
          onCancel={leaveAddMode}
        />
      </EditorCard>
    )}
    </>
  );
}

const PROBLEM_OPTIONS = [
  { value: "missing", label: "A árvore não está mais aqui" },
  { value: "maintenance", label: "Precisa de manutenção" },
  { value: "wrong_info", label: "Os dados estão incorretos" },
];

const PLANTING_OPTIONS = [
  { value: "calçada", label: "Calçada" },
  { value: "praça", label: "Praça" },
  { value: "canteiro central", label: "Canteiro central" },
  { value: "parque", label: "Parque" },
  { value: "interna ao lote", label: "Interna ao Lote" },
  { value: "faixa de rolamento", label: "Faixa de Rolamento" },
];

const EMPTY_ADDRESS = {
  LOGRADOURO_REFERENCIA: "",
  NUMERO_REFERENCIA: "",
  CEP: "",
};

function useReverseGeocode(coords, skip, setFormData) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (skip || !coords) return;
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;

    let active = true;
    setLoading(true);
    const [lng, lat] = coords;
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=pt`
    )
      .then((response) => response.json())
      .then((data) => {
        if (!active || !data.features?.length) return;
        const place = data.features[0];
        const context = place.context || [];
        const road = place.place_type?.includes("address")
          ? place.text
          : context.find((item) => item.id.startsWith("street"))?.text ||
            place.text ||
            "";
        const houseNumber =
          place.place_type?.includes("address") && place.address
            ? place.address
            : "";
        const postcode =
          context.find((item) => item.id.startsWith("postcode"))?.text || "";
        setFormData((prev) => ({
          ...prev,
          LOGRADOURO_REFERENCIA: road,
          NUMERO_REFERENCIA: houseNumber,
          CEP: postcode,
        }));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [coords, skip, setFormData]);

  return skip ? false : loading;
}

function usePhoto() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return {
    file,
    preview,
    select: (next) => {
      setFile(next);
      setPreview(URL.createObjectURL(next));
    },
    remove: () => {
      setFile(null);
      setPreview(null);
    },
  };
}

function AddressRow({ prefix, formData, onChange, loading, placeholders }) {
  return (
    <div className="editor-row editor-row-address">
      <EditorField
        id={`${prefix}-logradouro`}
        label="Logradouro"
        name="LOGRADOURO_REFERENCIA"
        placeholder={placeholders[0]}
        value={formData.LOGRADOURO_REFERENCIA}
        onChange={onChange}
        disabled={loading}
        loading={loading}
      />
      <EditorField
        id={`${prefix}-numero`}
        label="Número"
        name="NUMERO_REFERENCIA"
        placeholder={placeholders[1]}
        value={formData.NUMERO_REFERENCIA}
        onChange={onChange}
      />
      <EditorField
        id={`${prefix}-cep`}
        label="CEP"
        optional
        name="CEP"
        placeholder={placeholders[2]}
        value={formData.CEP}
        onChange={onChange}
      />
    </div>
  );
}

function EditorDone({ title, message, onDone }) {
  return (
    <EditorCard title={title} hint="Enviado" hintTone="success" onDismiss={onDone}>
      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          onDone();
        }}
      >
        <div className="editor-body">
          <p role="status" className="editor-done">
            {message}
          </p>
        </div>
        <EditorFooter submitLabel="Concluir" />
      </form>
    </EditorCard>
  );
}

function ReportProblemPanel({ coords, linkedTree, onSave, onCancel, onUseMyLocation }) {
  const [formData, setFormData] = useState({
    ...EMPTY_ADDRESS,
    REPORT_TYPE: "",
    OBSERVACOES: "",
  });
  const photo = usePhoto();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const fromTree =
    linkedTree?.LOGRADOURO_REFERENCIA || linkedTree?.CEP ? linkedTree : null;

  useEffect(() => {
    if (!fromTree) return;
    setFormData((prev) => ({
      ...prev,
      LOGRADOURO_REFERENCIA: fromTree.LOGRADOURO_REFERENCIA || "",
      NUMERO_REFERENCIA: fromTree.NUMERO_REFERENCIA || "",
      CEP: fromTree.CEP || "",
    }));
  }, [fromTree]);

  const loadingAddress = useReverseGeocode(coords, Boolean(fromTree), setFormData);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!coords || !formData.REPORT_TYPE || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onSave?.({
        reportType: formData.REPORT_TYPE,
        notes: formData.OBSERVACOES.trim(),
        logradouro: formData.LOGRADOURO_REFERENCIA.trim(),
        numero: formData.NUMERO_REFERENCIA.trim(),
        cep: formData.CEP.trim(),
        photoFile: photo.file,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || "Não foi possível enviar o relato.");
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <EditorDone
        title="Relatar um problema"
        message="Relato enviado. O ponto fica no mapa para as equipes responsáveis avaliarem."
        onDone={onCancel}
      />
    );
  }

  return (
    <EditorCard
      title="Relatar um problema"
      hint={
        linkedTree
          ? `Árvore #${linkedTree.ID} marcada. Informe o endereço e descreva o problema.`
          : coords
            ? "Informe o endereço e descreva o problema."
            : "Clique no mapa, de preferência sobre a árvore com problema."
      }
      hintTone={coords ? "success" : "default"}
      onDismiss={onCancel}
      onUseMyLocation={onUseMyLocation}
    >
      <form className="editor-form" onSubmit={submit}>
        <div className="editor-body">
          <AddressRow
            prefix="report"
            formData={formData}
            onChange={handleChange}
            loading={loadingAddress}
            placeholders={["Avenida Afonso Pena", "400", "30130-003"]}
          />
          <EditorField
            id="report-type"
            as="select"
            label="Tipo"
            name="REPORT_TYPE"
            required
            value={formData.REPORT_TYPE}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {PROBLEM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </EditorField>
          <EditorField
            id="report-notes"
            as="textarea"
            label="Observações"
            optional
            name="OBSERVACOES"
            rows={2}
            value={formData.OBSERVACOES}
            onChange={handleChange}
            placeholder="Ex.: galho seco sobre a calçada, risco para pedestres."
          />
          <EditorPhoto
            label="Adicionar foto do lugar"
            preview={photo.preview}
            onSelect={photo.select}
            onRemove={photo.remove}
          />
          {error && (
            <p role="alert" className="editor-alert">
              {error}
            </p>
          )}
        </div>
        <EditorFooter
          onCancel={onCancel}
          submitLabel={submitting ? "Enviando…" : "Enviar relato"}
          submitDisabled={!coords || !formData.REPORT_TYPE || submitting}
        />
      </form>
    </EditorCard>
  );
}

function SuggestPlantingPanel({ coords, onSave, onCancel, onUseMyLocation }) {
  const [formData, setFormData] = useState({
    ...EMPTY_ADDRESS,
    LOCAL_PLANTIO: "",
    OBSERVACOES: "",
  });
  const photo = usePhoto();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const loadingAddress = useReverseGeocode(coords, false, setFormData);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!coords || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onSave?.({
        notes: formData.OBSERVACOES.trim(),
        logradouro: formData.LOGRADOURO_REFERENCIA.trim(),
        numero: formData.NUMERO_REFERENCIA.trim(),
        cep: formData.CEP.trim(),
        localPlantio: formData.LOCAL_PLANTIO,
        photoFile: photo.file,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || "Não foi possível enviar a indicação.");
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <EditorDone
        title="Local para plantio"
        message="Indicação enviada. O ponto fica no mapa para as equipes responsáveis avaliarem um novo plantio."
        onDone={onCancel}
      />
    );
  }

  return (
    <EditorCard
      title="Local para plantio"
      hint={
        coords
          ? "Indique o endereço do lugar sugerido."
          : "Clique no mapa no lugar onde uma árvore poderia ser plantada."
      }
      hintTone={coords ? "success" : "default"}
      onDismiss={onCancel}
      onUseMyLocation={onUseMyLocation}
    >
      <form className="editor-form" onSubmit={submit}>
        <div className="editor-body">
          <AddressRow
            prefix="planting"
            formData={formData}
            onChange={handleChange}
            loading={loadingAddress}
            placeholders={["Rua da Bahia", "1200", "30130-000"]}
          />
          <EditorField
            id="planting-local"
            as="select"
            label="Local para plantio"
            optional
            name="LOCAL_PLANTIO"
            value={formData.LOCAL_PLANTIO}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {PLANTING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </EditorField>
          <EditorField
            id="planting-notes"
            as="textarea"
            label="Observação"
            optional
            name="OBSERVACOES"
            rows={3}
            value={formData.OBSERVACOES}
            onChange={handleChange}
            placeholder="Ex.: calçada larga sem sombra, em frente à escola."
          />
          <EditorPhoto
            label="Adicionar foto do lugar"
            preview={photo.preview}
            onSelect={photo.select}
            onRemove={photo.remove}
          />
          {error && (
            <p role="alert" className="editor-alert">
              {error}
            </p>
          )}
        </div>
        <EditorFooter
          onCancel={onCancel}
          submitLabel={submitting ? "Enviando…" : "Enviar local"}
          submitDisabled={!coords || submitting}
        />
      </form>
    </EditorCard>
  );
}

function EditAction({ icon: Icon, title, description, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-PrimaryLight ${
        active
          ? "border-PrimaryLight bg-PrimaryLight/8"
          : "border-gray-200 bg-white hover:border-PrimaryLight/40"
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-PrimaryLight/10 text-PrimaryLight">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={`block text-[13px] font-semibold ${active ? "text-PrimaryDark" : "text-gray-900"}`}>
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
          {description}
        </span>
      </span>
    </button>
  );
}

export default Toolbar;
