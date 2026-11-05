import { useEffect, useId, useRef, useState } from "react";
import {
  IoBarChartOutline,
  IoClose,
  IoLogOutOutline,
  IoMapOutline,
  IoPersonCircleOutline,
  IoSearch,
} from "react-icons/io5";
import { MAP_CENTER } from "../../map/config";
import { useAuth } from "../../context/AuthContext";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const SEARCH_BBOX = "-44.3,-20.4,-43.6,-19.5";

function Header({
  onSelectPlace,
  activeView = "map",
  onChangeView,
  userContributionCount = 0,
  mobileTab = "map",
  dimmed = false,
}) {
  const inputId = useId();
  const listId = useId();
  const rootRef = useRef(null);
  const abortRef = useRef(null);
  const selectedQueryRef = useRef("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const { user, openAuthModal, signOut, isSupabaseConfigured } = useAuth();

  useEffect(() => {
    if (!dimmed) return;
    setOpen(false);
    setAccountOpen(false);
  }, [dimmed]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2 || text === selectedQueryRef.current) {
      abortRef.current?.abort();
      setResults([]);
      setOpen(false);
      setActiveIndex(-1);
      setStatus("");
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("Buscando…");

      try {
        const url = new URL(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json`
        );
        url.searchParams.set("access_token", TOKEN);
        url.searchParams.set("language", "pt");
        url.searchParams.set("country", "br");
        url.searchParams.set("limit", "5");
        url.searchParams.set("proximity", `${MAP_CENTER[0]},${MAP_CENTER[1]}`);
        url.searchParams.set("bbox", SEARCH_BBOX);
        url.searchParams.set(
          "types",
          "address,poi,neighborhood,locality,place"
        );

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("search failed");
        const data = await response.json();
        const next = data.features ?? [];
        setResults(next);
        setOpen(true);
        setActiveIndex(next.length ? 0 : -1);
        setStatus(
          next.length
            ? `${next.length} ${next.length === 1 ? "lugar" : "lugares"}`
            : "Nenhum lugar encontrado."
        );
      } catch (error) {
        if (error.name === "AbortError") return;
        setResults([]);
        setOpen(true);
        setActiveIndex(-1);
        setStatus("Não foi possível buscar agora.");
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const selectPlace = (feature) => {
    if (!feature) return;
    const label = feature.text || feature.place_name;
    selectedQueryRef.current = label;
    setQuery(label);
    setOpen(false);
    setStatus(feature.place_name);
    onChangeView?.("map");
    onSelectPlace?.({
      id: feature.id,
      label: feature.place_name,
      center: feature.center,
      placeType: feature.place_type?.[0] ?? "place",
    });
  };

  const clearSearch = () => {
    selectedQueryRef.current = "";
    abortRef.current?.abort();
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    setStatus("");
  };

  const onSearchKeyDown = (event) => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        index <= 0 ? results.length - 1 : index - 1
      );
    } else if (event.key === "Escape") {
      setOpen(false);
      setAccountOpen(false);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const feature = results[activeIndex] ?? results[0];
      if (feature) selectPlace(feature);
    }
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Colaborador";

  return (
    <header
      ref={rootRef}
      className={`relative z-20 flex h-16 shrink-0 items-center gap-3 bg-PrimaryDark pr-3 transition-opacity max-md:h-auto max-md:bg-[#F3F4F6] max-md:px-4 max-md:py-3 ${
        mobileTab !== "map" ? "max-md:hidden" : ""
      } ${dimmed ? "pointer-events-none opacity-[0.55] select-none" : ""}`}
      inert={dimmed}
    >
      <div className="flex h-full w-80 shrink-0 items-center px-3 max-md:h-auto max-md:w-auto max-md:px-0">
        <p className="text-sm font-semibold tracking-wide text-white max-md:font-bold max-md:text-PrimaryDark">
          GDU <span className="font-medium text-white/75 max-md:hidden">RMBH</span>
        </p>
      </div>

      <form
        role="search"
        className="relative min-w-0 max-w-xl flex-1"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor={inputId} className="sr-only">
          Pesquisar endereço ou bairro
        </label>
        <IoSearch
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          role="combobox"
          autoComplete="off"
          placeholder={narrow ? "Buscar endereço" : "Pesquisar endereço ou bairro"}
          value={query}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (
              results.length &&
              query.trim() !== selectedQueryRef.current
            ) {
              setOpen(true);
            }
          }}
          onKeyDown={onSearchKeyDown}
          className="h-10 w-full rounded-lg bg-white pr-10 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white max-md:rounded-xl max-md:border max-md:border-gray-200 max-md:text-[13px] max-md:placeholder:font-medium max-md:focus-visible:ring-PrimaryLight [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpar pesquisa"
            onClick={clearSearch}
            className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-PrimaryLight"
          >
            <IoClose className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <p className="sr-only" role="status">
          {status}
        </p>
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Lugares encontrados"
            className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">{status}</li>
            ) : (
              results.map((feature, index) => {
                const detail = feature.place_name.startsWith(feature.text)
                  ? feature.place_name
                      .slice(feature.text.length)
                      .replace(/^,\s*/, "")
                  : feature.place_name;
                const selected = index === activeIndex;
                return (
                  <li
                    key={feature.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={selected}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectPlace(feature)}
                      className={`flex w-full cursor-pointer flex-col px-3 py-2 text-left focus-visible:outline-none ${
                        selected ? "bg-gray-100" : "bg-white"
                      }`}
                    >
                      <span className="truncate text-sm font-medium text-gray-900">
                        {feature.text}
                      </span>
                      {detail && (
                        <span className="truncate text-xs text-gray-500">
                          {detail}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </form>

      <nav aria-label="Seções" className="ml-auto flex items-center gap-1 max-md:hidden">
        <button
          type="button"
          aria-current={activeView === "map" ? "page" : undefined}
          onClick={() => onChangeView?.("map")}
          className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            activeView === "map"
              ? "bg-white/15 text-white"
              : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          <IoMapOutline className="h-4 w-4" aria-hidden="true" />
          Mapa
        </button>
        <button
          type="button"
          aria-current={activeView === "dashboard" ? "page" : undefined}
          onClick={() => onChangeView?.("dashboard")}
          className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            activeView === "dashboard"
              ? "bg-white/15 text-white"
              : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          <IoBarChartOutline className="h-4 w-4" aria-hidden="true" />
          Painel
        </button>
      </nav>

      <div className="relative">
        {user ? (
          <>
            <button
              type="button"
              aria-expanded={accountOpen}
              aria-controls="account-menu"
              onClick={() => {
                setAccountOpen((prev) => !prev);
                setOpen(false);
              }}
              aria-label={narrow ? `Conta de ${displayName}` : undefined}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white max-md:h-10 max-md:w-10 max-md:justify-center max-md:rounded-xl max-md:border max-md:border-gray-200 max-md:bg-white max-md:p-0 max-md:text-PrimaryDark max-md:focus-visible:ring-PrimaryLight"
            >
              <IoPersonCircleOutline className="h-5 w-5" aria-hidden="true" />
              <span className="max-w-32 truncate max-md:hidden">{displayName}</span>
            </button>
            {accountOpen && (
              <div
                id="account-menu"
                role="dialog"
                aria-label="Conta do usuário"
                className="absolute top-full right-0 z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
              >
                <p className="truncate text-sm font-semibold text-gray-900">
                  {displayName}
                </p>
                <p className="truncate text-xs text-gray-500">{user.email}</p>
                <div className="mt-2.5 rounded-lg bg-gray-50 px-2.5 py-2 text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Contribuições na sessão</span>
                    <strong className="font-semibold text-PrimaryDark">
                      {userContributionCount}
                    </strong>
                  </div>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {isSupabaseConfigured
                      ? "Sincronizado com Supabase"
                      : "Sessão local"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setAccountOpen(false);
                    await signOut();
                  }}
                  className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <IoLogOutOutline className="h-4 w-4" />
                  Sair da conta
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openAuthModal("login");
            }}
            className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-PrimaryDark hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white max-md:h-10 max-md:rounded-xl max-md:bg-PrimaryDark max-md:text-white max-md:focus-visible:ring-PrimaryLight"
          >
            Entrar
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
