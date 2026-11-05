import { useEffect, useId, useState } from "react";
import { IoClose } from "react-icons/io5";
import "./style.css";
import { useAuth } from "../../context/AuthContext";
import { submitTreeReport } from "../../lib/treesApi";

const SMALL_WORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "ao",
  "à",
  "aos",
  "às",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "para",
  "com",
]);

function titleCasePt(value) {
  return String(value)
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const bare = word.replace(/[.,]/g, "");
      if (/^s\/?n$/i.test(bare)) return word.replace(bare, "s/n");
      if (index > 0 && SMALL_WORDS.has(bare)) return word;
      return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1);
    })
    .join(" ");
}

function sentenceCasePt(value) {
  const text = String(value).trim().toLocaleLowerCase("pt-BR");
  if (!text) return "";
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

function present(value) {
  const text = value == null ? "" : String(value).trim();
  if (!text || text.toLowerCase() === "n/a") return "";
  return text;
}

function formatNumber(value) {
  const text = present(value);
  if (!text) return "";
  if (/^s\s*\/?\s*n$/i.test(text)) return "s/n";
  return text;
}

function formatAddress(street, number) {
  const streetText = present(street);
  const numberText = formatNumber(number);
  if (!streetText && !numberText) return "";
  const formattedStreet = streetText ? titleCasePt(streetText) : "";
  if (!numberText) return formattedStreet;
  return formattedStreet ? `${formattedStreet}, ${numberText}` : numberText;
}

function formatSurveyDate(value) {
  const raw = present(value);
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function TreeCard({ tree, loading = false, detailError = false, onClose, onDelete, onReportSubmitted }) {
  const titleId = useId();
  const [showReportOptions, setShowReportOptions] = useState(false);
  const [reportStatus, setReportStatus] = useState("");
  const [reportIsError, setReportIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const { user, openAuthModal } = useAuth();

  const popularName = present(tree.NOME_POPULAR) || "Árvore sem nome popular";
  const scientificName = present(tree.NOME_CIENTIFICO);
  const address = formatAddress(tree.LOGRADOURO_REFERENCIA, tree.NUMERO_REFERENCIA);
  const planting = present(tree.LOCAL_PLANTIO);
  const kind = present(tree.TIPO_INDIVIDUO);
  const surveyDate = formatSurveyDate(tree.DATA_LEVANTAMENTO);
  const hasPhoto = Boolean(present(tree.FOTO_URL)) && !photoFailed;

  useEffect(() => {
    setPhotoFailed(false);
    setShowReportOptions(false);
    setReportStatus("");
    setReportIsError(false);
  }, [tree.ID]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (showReportOptions) {
        setShowReportOptions(false);
        return;
      }
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, showReportOptions]);

  const handleReport = async (reportType) => {
    if (!user) {
      openAuthModal(
        "login",
        "Entre na sua conta para relatar problemas ou atualizar árvores."
      );
      return;
    }

    setSubmitting(true);
    setReportStatus("");
    setReportIsError(false);
    try {
      await submitTreeReport({
        treeId: tree.ID,
        reportType,
        notes: null,
        user,
        createdBy: tree.CREATED_BY,
      });

      onReportSubmitted?.();
      setShowReportOptions(false);

      if (reportType === "missing") {
        const isOwnTree =
          tree.CREATED_BY && String(tree.CREATED_BY) === String(user.id);
        if (isOwnTree) {
          onDelete(tree.ID);
        } else {
          setReportStatus(
            "Relato enviado para revisão. Árvores do inventário oficial continuam no mapa até a vistoria."
          );
        }
      } else {
        setReportStatus("Relato registrado. Obrigado.");
      }
    } catch (err) {
      setReportIsError(true);
      setReportStatus(err.message || "Não foi possível registrar o relato.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className="tree-card" aria-labelledby={titleId}>
      <header className="tree-card-header">
        <div className="min-w-0">
          <p className="tree-card-kicker">Árvore selecionada</p>
          <h2 id={titleId} className="tree-card-title">
            {popularName}
          </h2>
          {scientificName && (
            <p className="tree-card-scientific">{scientificName}</p>
          )}
        </div>
        <button
          type="button"
          className="tree-card-close"
          onClick={onClose}
          aria-label="Fechar detalhes da árvore"
        >
          <IoClose aria-hidden="true" />
        </button>
      </header>

      <div className="tree-card-body">
        {loading ? (
          <p className="tree-card-loading">Carregando detalhes…</p>
        ) : detailError ? (
          <p className="tree-card-loading">Não foi possível carregar os detalhes.</p>
        ) : (
          <>
            {hasPhoto && (
              <figure className="tree-card-photo">
                <img
                  src={tree.FOTO_URL}
                  alt={`Foto de ${popularName}`}
                  onError={() => setPhotoFailed(true)}
                />
                <figcaption>Foto da árvore</figcaption>
              </figure>
            )}

            {(kind || planting) && (
              <ul className="tree-card-chips">
                {kind && <li>{sentenceCasePt(kind)}</li>}
                {planting && <li>{sentenceCasePt(planting)}</li>}
              </ul>
            )}

            <dl className="tree-card-facts">
              <div>
                <dt>Endereço</dt>
                <dd>{address || "Endereço não informado"}</dd>
              </div>
              <div>
                <dt>Levantamento</dt>
                <dd>{surveyDate || "Data não informada"}</dd>
              </div>
              <div>
                <dt>Registro</dt>
                <dd>#{tree.ID}</dd>
              </div>
            </dl>
          </>
        )}
      </div>

      <footer className="tree-card-footer">
        {loading ? null : (
          <>
            {reportStatus && (
              <p
                role="status"
                className={
                  reportIsError ? "tree-card-status is-error" : "tree-card-status"
                }
              >
                {reportStatus}
              </p>
            )}

            {!showReportOptions ? (
              <button
                type="button"
                className="tree-card-report"
                onClick={() => setShowReportOptions(true)}
              >
                Relatar um problema
              </button>
            ) : (
              <div className="tree-card-report-options">
                <p>O que você quer relatar?</p>
                <button
                  type="button"
                  className="is-danger"
                  disabled={submitting}
                  onClick={() => handleReport("missing")}
                >
                  A árvore não está mais aqui
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleReport("maintenance")}
                >
                  Precisa de manutenção
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleReport("wrong_info")}
                >
                  Os dados estão incorretos
                </button>
                <button
                  type="button"
                  className="is-quiet"
                  disabled={submitting}
                  onClick={() => setShowReportOptions(false)}
                >
                  Cancelar
                </button>
              </div>
            )}
          </>
        )}
      </footer>
    </aside>
  );
}

export default TreeCard;
