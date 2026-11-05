import { IoBarChartOutline, IoLayersOutline, IoMapOutline, IoPencilOutline } from "react-icons/io5";

const TABS = [
  { id: "map", label: "Mapa", icon: IoMapOutline },
  { id: "layers", label: "Camadas", icon: IoLayersOutline },
  { id: "edit", label: "Editar", icon: IoPencilOutline },
  { id: "dashboard", label: "Painel", icon: IoBarChartOutline },
];

function MobileTabBar({ active, onChange }) {
  return (
    <nav
      aria-label="Seções"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="flex h-14 rounded-full bg-white/95 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => onChange(id)}
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold ${
                selected
                  ? "bg-PrimaryLight/10 text-PrimaryDark"
                  : "text-gray-500"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileTabBar;
