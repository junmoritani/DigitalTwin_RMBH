import { useEffect, useMemo, useState } from "react";
import {
  IoAlertCircleOutline,
  IoClose,
  IoLeafOutline,
  IoLocationOutline,
  IoOpenOutline,
  IoSearch,
  IoSparklesOutline,
  IoStatsChartOutline,
} from "react-icons/io5";
import { fetchAnalyticsSummary } from "../../lib/treesApi";
import { formatArea, formatPct, formatTrees } from "../../map/bairroDensity";

const MIN_MEANINGFUL_AREA_KM2 = 0.08;

function Dashboard({ onFlyToBairro, onFilterSpeciesOnMap }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rankingMode, setRankingMode] = useState("lowest_density");
  const [bairroQuery, setBairroQuery] = useState("");
  const [selectedBairro, setSelectedBairro] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchAnalyticsSummary(controller.signal)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Erro ao carregar dados do painel.");
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const validBairros = useMemo(() => {
    const list = data?.bairros ?? [];
    return list.filter(
      (b) => (b.areaKm2 ?? 0) >= MIN_MEANINGFUL_AREA_KM2 && (b.treeCount ?? 0) > 0
    );
  }, [data]);

  const rankedBairros = useMemo(() => {
    const q = bairroQuery.trim().toLowerCase();
    const filtered = validBairros.filter((b) =>
      q ? b.nome.toLowerCase().includes(q) : true
    );

    const copy = [...filtered];
    if (rankingMode === "lowest_density") {
      copy.sort((a, b) => a.treesPerKm2 - b.treesPerKm2);
    } else if (rankingMode === "highest_density") {
      copy.sort((a, b) => b.treesPerKm2 - a.treesPerKm2);
    } else if (rankingMode === "richest_species") {
      copy.sort((a, b) => b.speciesCount - a.speciesCount);
    } else if (rankingMode === "monoculture_risk") {
      copy.sort((a, b) => b.topSpeciesShare - a.topSpeciesShare);
    }
    return copy;
  }, [validBairros, bairroQuery, rankingMode]);

  const monocultureBairros = useMemo(() => {
    return validBairros
      .filter((b) => b.treeCount >= 80 && b.topSpeciesShare >= 25)
      .sort((a, b) => b.topSpeciesShare - a.topSpeciesShare)
      .slice(0, 12);
  }, [validBairros]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50 p-8">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-PrimaryLight border-t-transparent" />
          <p className="mt-3 text-sm font-medium text-gray-600">
            Carregando indicadores da floresta urbana de Belo Horizonte…
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-xs">
          <p className="text-sm font-semibold text-red-700">
            Não foi possível abrir o painel analítico
          </p>
          <p className="mt-1 text-xs text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const { kpis = {}, topSpecies = [], plantingLocations = [] } = data;
  const maxSpeciesCount = topSpecies[0]?.count || 1;
  const maxBairroDensity =
    Math.max(...validBairros.map((b) => b.treesPerKm2 || 0), 1) || 1;

  return (
    <main className="flex min-h-0 flex-1 overflow-y-auto bg-gray-50 max-md:pb-24">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 max-md:px-4 max-md:pt-5">
        {/* Header banner */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-PrimaryLight/15 px-3 py-1 text-xs font-semibold text-PrimaryDark max-md:hidden">
              <IoStatsChartOutline className="h-3.5 w-3.5" />
              Diagnóstico da Floresta Urbana · Belo Horizonte
            </span>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 max-md:text-[1.75rem]">
              <span className="max-md:hidden">
                Painel de Biodiversidade e Densidade por Bairro
              </span>
              <span className="hidden max-md:inline">Painel</span>
            </h1>
            <p className="mt-0.5 text-sm text-gray-600">
              Cálculo sobre a malha urbana útil (excluindo parques, reservas,
              Lagoa da Pampulha, clubes, campi e grandes equipamentos).
            </p>
          </div>
          {selectedBairro && (
            <button
              type="button"
              onClick={() => onFlyToBairro?.(selectedBairro)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-PrimaryDark px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-PrimaryLight"
            >
              <IoLocationOutline className="h-4 w-4" />
              Ver {selectedBairro.nome} no mapa
            </button>
          )}
        </div>

        {/* KPI Cards */}
        <section
          aria-label="Indicadores gerais"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <KpiCard
            icon={IoLeafOutline}
            label="Árvores catalogadas"
            value={formatTrees(kpis.totalTrees)}
            detail={`${formatTrees(kpis.treesInBairros)} em área urbana útil (${formatTrees(
              kpis.totalBairros
            )} bairros)`}
          />
          <KpiCard
            icon={IoLocationOutline}
            label="Densidade média urbana"
            value={`${formatTrees(kpis.avgTreesPerKm2)} / km²`}
            detail={`Em ${formatArea(kpis.totalAreaKm2)} km² de área útil analisada`}
          />
          <KpiCard
            icon={IoSparklesOutline}
            label="Riqueza de espécies"
            value={formatTrees(kpis.popularSpeciesCount)}
            detail="Nomes populares distintos registrados no SIIA"
          />
          <KpiCard
            icon={IoAlertCircleOutline}
            label="Sem identificação botânica"
            value={`${formatPct(kpis.unidentifiedPct)}%`}
            detail={`${formatTrees(
              (kpis.totalTrees || 0) - (kpis.identifiedTrees || 0)
            )} árvores aguardam identificação`}
            tone="amber"
          />
        </section>

        {/* Main 2-column grid: Neighborhood Ranking + Species Breakdown */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 cols: Neighborhood Ranking */}
          <section className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-xs lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Ranking e Comparativo de Bairros
                </h2>
                <p className="text-xs text-gray-500">
                  Clique em um bairro para inspecionar suas espécies ou voar
                  para ele no mapa.
                </p>
              </div>
              <div className="relative w-full sm:w-56">
                <IoSearch className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={bairroQuery}
                  onChange={(e) => setBairroQuery(e.target.value)}
                  placeholder="Filtrar bairro…"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pr-3 pl-8 text-xs text-gray-800 focus:border-PrimaryLight focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Mode pills */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                {
                  id: "lowest_density",
                  label: "Menor densidade (Prioridade de plantio)",
                },
                {
                  id: "highest_density",
                  label: "Maior densidade arbórea",
                },
                {
                  id: "richest_species",
                  label: "Maior diversidade de espécies",
                },
                {
                  id: "monoculture_risk",
                  label: "Maior concentração (Monocultura)",
                },
              ].map((tab) => {
                const active = rankingMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRankingMode(tab.id)}
                    className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-PrimaryDark text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Table */}
            <div className="mt-4 max-h-[460px] overflow-y-auto pr-1">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-white text-[11px] font-semibold uppercase text-gray-400">
                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Bairro</th>
                    <th className="py-2 pr-2 text-right">Árvores/km²</th>
                    <th className="py-2 pr-2 text-right">Árvores</th>
                    <th className="py-2 pr-2 text-right">Espécies</th>
                    <th className="py-2 pr-2">Dominante</th>
                    <th className="py-2 text-right">Mapa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rankedBairros.slice(0, 60).map((b, idx) => {
                    const isSelected = selectedBairro?.id === b.id;
                    const barPct = Math.min(
                      100,
                      Math.round(((b.treesPerKm2 || 0) / maxBairroDensity) * 100)
                    );
                    return (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedBairro(b)}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? "bg-PrimaryLight/10"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="py-2.5 pr-2 font-semibold text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="font-semibold text-gray-900">
                            {b.nome}
                          </div>
                          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-PrimaryLight"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 pr-2 text-right font-bold text-PrimaryDark">
                          {formatTrees(b.treesPerKm2)}
                        </td>
                        <td className="py-2.5 pr-2 text-right text-gray-600">
                          {formatTrees(b.treeCount)}
                        </td>
                        <td className="py-2.5 pr-2 text-right text-gray-600">
                          {formatTrees(b.speciesCount)}
                        </td>
                        <td className="py-2.5 pr-2">
                          {b.topSpecies ? (
                            <span className="inline-flex items-center gap-1 text-gray-700">
                              <span className="max-w-28 truncate">
                                {b.topSpecies}
                              </span>
                              <span
                                className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
                                  b.topSpeciesShare >= 25
                                    ? "bg-red-100 text-red-700"
                                    : b.topSpeciesShare >= 15
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {formatPct(b.topSpeciesShare)}%
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onFlyToBairro?.(b);
                            }}
                            title={`Ir para ${b.nome} no mapa`}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-PrimaryDark hover:border-PrimaryLight hover:bg-PrimaryLight/10"
                          >
                            Mapa
                            <IoOpenOutline className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right 5 cols: Species & Biodiversity Breakdown */}
          <section className="flex flex-col gap-6 lg:col-span-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-base font-bold text-gray-900">
                  Espécies Mais Frequentes em BH
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Regra 10/20/30 de silvicultura urbana: nenhuma espécie deve
                  ultrapassar <strong>10%</strong> do total identificado. Clique
                  para filtrar no mapa.
                </p>
              </div>

              <ul className="mt-3 max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
                {topSpecies.slice(0, 15).map((sp) => {
                  const widthPct = Math.max(
                    4,
                    Math.round((sp.count / maxSpeciesCount) * 100)
                  );
                  const exceedsRule = sp.sharePct >= 10;
                  return (
                    <li key={sp.nomePopular} className="group">
                      <button
                        type="button"
                        onClick={() => onFilterSpeciesOnMap?.(sp.nomePopular)}
                        className="w-full cursor-pointer rounded-lg p-1.5 text-left transition hover:bg-gray-50"
                      >
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate font-semibold text-gray-900 group-hover:text-PrimaryLight">
                            {sp.nomePopular}{" "}
                            {sp.nomeCientifico && (
                              <em className="font-normal text-gray-400">
                                ({sp.nomeCientifico})
                              </em>
                            )}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-gray-700">
                            {formatTrees(sp.count)}{" "}
                            <span
                              className={`ml-1 rounded px-1 py-0.5 text-[10px] ${
                                exceedsRule
                                  ? "bg-amber-100 font-bold text-amber-900"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {formatPct(sp.sharePct)}%
                            </span>
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${
                              exceedsRule ? "bg-amber-500" : "bg-PrimaryLight"
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Monoculture Alerts */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
              <h2 className="text-sm font-bold text-gray-900">
                Alertas de Monocultura por Bairro (&gt;25%)
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Bairros onde mais de um quarto das árvores identificadas pertence
                a uma única espécie, elevando vulnerabilidade a pragas.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {monocultureBairros.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBairro(b)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-1.5 text-left text-xs transition hover:bg-red-100"
                  >
                    <span className="font-semibold text-gray-900">
                      {b.nome}
                    </span>
                    <span className="text-gray-600">· {b.topSpecies}</span>
                    <span className="rounded bg-red-200/80 px-1.5 py-0.5 text-[10px] font-bold text-red-900">
                      {formatPct(b.topSpeciesShare)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Selected Bairro Inspector Drawer / Card */}
        {selectedBairro && (
          <section
            aria-label={`Detalhes do bairro ${selectedBairro.nome}`}
            className="rounded-2xl border-2 border-PrimaryLight/40 bg-white p-5 shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-PrimaryLight">
                  Raio-X do Bairro Selecionado
                </span>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedBairro.nome}
                </h2>
                <p className="text-xs text-gray-500">
                  Área urbana útil analisada:{" "}
                  <strong>{formatArea(selectedBairro.areaKm2)} km²</strong> ·
                  Índice de diversidade de Shannon:{" "}
                  <strong>{formatPct(selectedBairro.shannonIndex)}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onFlyToBairro?.(selectedBairro)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-PrimaryDark px-3.5 py-2 text-xs font-semibold text-white hover:bg-PrimaryLight"
                >
                  <IoLocationOutline className="h-4 w-4" />
                  Explorar no mapa
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBairro(null)}
                  aria-label="Fechar detalhes do bairro"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
                >
                  <IoClose className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">
                  Comparativo de Densidade vs. Média de BH
                </p>
                <p className="mt-1 text-2xl font-bold text-PrimaryDark">
                  {formatTrees(selectedBairro.treesPerKm2)}{" "}
                  <span className="text-sm font-normal text-gray-500">
                    árvores/km²
                  </span>
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Média municipal:{" "}
                  <strong>{formatTrees(kpis.avgTreesPerKm2)} árvores/km²</strong>{" "}
                  (
                  {selectedBairro.treesPerKm2 >= kpis.avgTreesPerKm2
                    ? `+${formatPct(
                        ((selectedBairro.treesPerKm2 - kpis.avgTreesPerKm2) *
                          100) /
                          (kpis.avgTreesPerKm2 || 1)
                      )}% acima da média`
                    : `${formatPct(
                        ((selectedBairro.treesPerKm2 - kpis.avgTreesPerKm2) *
                          100) /
                          (kpis.avgTreesPerKm2 || 1)
                      )}% abaixo da média`}
                  )
                </p>
                <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Total de árvores no bairro:</span>
                    <strong>{formatTrees(selectedBairro.treeCount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Espécies distintas:</span>
                    <strong>{formatTrees(selectedBairro.speciesCount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Sem identificação:</span>
                    <strong>{formatPct(selectedBairro.unidentifiedPct)}%</strong>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs font-semibold text-gray-700">
                  Top 5 espécies em {selectedBairro.nome}
                </p>
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(selectedBairro.topSpeciesList ?? []).map((sp) => (
                    <div
                      key={sp.nomePopular}
                      className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-semibold text-gray-900">
                          {sp.nomePopular}
                        </p>
                        {sp.nomeCientifico && (
                          <p className="truncate text-[11px] italic text-gray-400">
                            {sp.nomeCientifico}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block font-bold text-PrimaryDark">
                          {formatPct(sp.sharePct)}%
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {formatTrees(sp.count)} árv.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Planting condition summary */}
        {plantingLocations.length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-bold text-gray-900">
              Distribuição por Local de Plantio
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {plantingLocations.slice(0, 6).map((loc) => (
                <div
                  key={loc.label}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                >
                  <p className="truncate text-xs font-medium text-gray-500">
                    {loc.label}
                  </p>
                  <p className="mt-1 text-base font-bold text-gray-900">
                    {formatTrees(loc.count)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function KpiCard({ icon: Icon, label, value, detail, tone = "green" }) {
  const badgeClass =
    tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : "bg-PrimaryLight/15 text-PrimaryDark";

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500">{label}</span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${badgeClass}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

export default Dashboard;
