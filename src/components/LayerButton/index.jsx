import { useId } from "react";

function LayerButton({ label, description, checked, onChange, swatch }) {
  const id = useId();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-desc`}
      onClick={() => onChange(!checked)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-PrimaryLight"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50"
        aria-hidden="true"
      >
        {swatch}
      </span>
      <span className="min-w-0 flex-1">
        <span
          id={`${id}-label`}
          className="block text-sm font-semibold text-gray-900"
        >
          {label}
        </span>
        <span
          id={`${id}-desc`}
          className="mt-0.5 block text-xs leading-snug text-gray-500"
        >
          {description}
        </span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-PrimaryLight" : "bg-gray-300"
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export default LayerButton;
