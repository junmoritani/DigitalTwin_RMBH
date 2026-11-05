import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { IoChevronBack, IoClose } from "react-icons/io5";
import { MdDelete, MdMyLocation, MdPhotoCamera } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import "./style.css";

function EditorCard({ title, hint, hintTone = "default", onDismiss, onUseMyLocation, children }) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onDismiss?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return createPortal(
    <div role="dialog" aria-modal="false" aria-labelledby={titleId} className="editor-card">
      <header className="editor-titlebar">
        <button
          type="button"
          className="editor-back"
          onClick={onDismiss}
          aria-label="Voltar"
        >
          <IoChevronBack aria-hidden="true" />
        </button>
        <div className="editor-titles">
          <h2 id={titleId} className="editor-title">
            {title}
          </h2>
          {hint && (
            <p role="status" className={`editor-hint is-${hintTone}`}>
              {hint}
            </p>
          )}
        </div>
        {onUseMyLocation && (
          <button type="button" className="editor-locate" onClick={onUseMyLocation}>
            <MdMyLocation aria-hidden="true" />
            <span>Usar minha localização</span>
          </button>
        )}
        <button
          type="button"
          className="editor-close"
          onClick={onDismiss}
          aria-label="Fechar editor"
        >
          <IoClose aria-hidden="true" />
        </button>
      </header>
      {children}
    </div>,
    document.body
  );
}

export function EditorField({ id, label, optional = false, loading = false, as = "input", children, ...props }) {
  const Control = as;
  return (
    <div className="editor-field">
      <label htmlFor={id} className="editor-label">
        {label}
        {optional && <span className="editor-optional"> opcional</span>}
        {loading && (
          <AiOutlineLoading3Quarters className="editor-label-spinner" aria-label="Buscando endereço" />
        )}
      </label>
      <Control id={id} className="editor-control" {...props}>
        {children}
      </Control>
    </div>
  );
}

export function EditorPhoto({ label, preview, onSelect, onRemove }) {
  const inputRef = useRef(null);

  const remove = () => {
    onRemove();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="editor-photo-wrap">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
        }}
        className="hidden"
      />
      {preview ? (
        <div className="editor-photo-preview">
          <img src={preview} alt="Foto selecionada" />
          <button type="button" onClick={remove} aria-label="Remover foto">
            <MdDelete aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="editor-photo"
          onClick={() => inputRef.current?.click()}
        >
          <MdPhotoCamera aria-hidden="true" />
          {label}
        </button>
      )}
    </div>
  );
}

export function EditorFooter({ onCancel, submitLabel, submitDisabled = false, cancelLabel = "Cancelar" }) {
  return (
    <div className="editor-footer">
      {onCancel && (
        <button type="button" className="editor-button is-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
      )}
      <button type="submit" className="editor-button is-primary" disabled={submitDisabled}>
        {submitLabel}
      </button>
    </div>
  );
}

export default EditorCard;
