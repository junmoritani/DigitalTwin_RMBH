"""Compute per-bairro species diversity and citywide analytics, and optionally
upload the GDU RMBH tree inventory + bairros_stats to Supabase Postgres.

Usage:
  1) Enrich local public/data/bairro_tree_density.geojson and generate
     public/data/analytics_summary.json from the local PostGIS database:
       api/.venv/Scripts/python.exe -u db/upload_to_supabase.py --enrich-local

  2) Run the full migration + bulk upload to Supabase:
       $env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<password>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
       api/.venv/Scripts/python.exe -u db/upload_to_supabase.py --upload
"""

import argparse
import io
import json
import math
import os
import sys
import time
from collections import Counter
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.db import connect as connect_local

DATA_DIR = ROOT / "public" / "data"
BAIRRO_DENSITY_PATH = DATA_DIR / "bairro_tree_density.geojson"
ANALYTICS_SUMMARY_PATH = DATA_DIR / "analytics_summary.json"
MIGRATION_SQL_PATH = ROOT / "db" / "supabase_migration.sql"

UNIDENTIFIED_LABELS = {
    "",
    "sem identificação",
    "sem identificacao",
    "nao identificada",
    "não identificada",
    "desconhecida",
    "indeterminada",
    "n/a",
    "ni",
    "nid",
}


def clean_species(name: str | None) -> str | None:
    if not name:
        return None
    cleaned = " ".join(str(name).strip().split())
    if cleaned.lower() in UNIDENTIFIED_LABELS:
        return None
    return cleaned


def geom_bbox(geometry: dict) -> list[float] | None:
    coords = []

    def walk(node):
        if not isinstance(node, list) or not node:
            return
        if isinstance(node[0], (int, float)) and len(node) >= 2:
            coords.append((float(node[0]), float(node[1])))
        else:
            for child in node:
                walk(child)

    walk(geometry.get("coordinates", []))
    if not coords:
        return None
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return [
        round(min(lngs), 5),
        round(min(lats), 5),
        round(max(lngs), 5),
        round(max(lats), 5),
    ]


def shannon_diversity(counts: Counter) -> float:
    total = sum(counts.values())
    if total <= 0 or len(counts) <= 1:
        return 0.0
    entropy = 0.0
    for c in counts.values():
        if c > 0:
            p = c / total
            entropy -= p * math.log(p)
    return round(entropy, 2)


def enrich_from_local_db() -> tuple[dict, dict, dict[int, int]]:
    """Use the local PostGIS database and existing clipped bairro polygons to
    compute species richness, dominant species, monoculture share, and citywide
    analytics in seconds.
    """
    if not BAIRRO_DENSITY_PATH.exists():
        raise FileNotFoundError(f"Missing {BAIRRO_DENSITY_PATH}")

    started = time.time()
    density_geojson = json.loads(BAIRRO_DENSITY_PATH.read_text(encoding="utf-8"))
    features = density_geojson.get("features", [])

    print(f"Loaded {len(features)} clipped bairros from {BAIRRO_DENSITY_PATH.name}...")

    tree_to_bairro: dict[int, int] = {}

    with connect_local() as conn:
        conn.execute(
            """
            CREATE TEMP TABLE clipped_bairros (
              id integer PRIMARY KEY,
              nome text NOT NULL,
              area_km2 double precision NOT NULL,
              geom geometry(Geometry, 4326) NOT NULL
            )
            """
        )
        bairro_rows = [
            (
                int(f["properties"]["ID"]),
                f["properties"]["NOME"],
                float(f["properties"].get("AREA_KM2") or 0),
                json.dumps(f["geometry"]),
            )
            for f in features
            if f.get("geometry")
        ]
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO clipped_bairros (id, nome, area_km2, geom)
                VALUES (
                  %s,
                  %s,
                  %s,
                  ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
                )
                """,
                bairro_rows,
            )
        conn.execute(
            "CREATE INDEX clipped_bairros_gix ON clipped_bairros USING GIST (geom)"
        )
        conn.execute("ANALYZE clipped_bairros")

        print("Matching trees to clipped bairros and reading species...")
        matched_rows = conn.execute(
            """
            SELECT
              b.id AS bairro_id,
              t.id AS tree_id,
              t.nome_popular,
              t.nome_cientifico
            FROM clipped_bairros b
            JOIN trees t
              ON t.geom && b.geom
             AND ST_CoveredBy(t.geom, b.geom)
            """
        ).fetchall()

        all_trees_rows = conn.execute(
            """
            SELECT
              count(*)::int AS total_trees,
              count(*) FILTER (WHERE local_plantio IS NOT NULL AND btrim(local_plantio) <> '')::int AS with_local
            FROM trees
            """
        ).fetchone()

        city_species_rows = conn.execute(
            """
            SELECT
              btrim(nome_popular) AS nome_popular,
              max(btrim(nome_cientifico)) AS nome_cientifico,
              count(*)::int AS n
            FROM trees
            GROUP BY btrim(nome_popular)
            ORDER BY n DESC
            """
        ).fetchall()

        planting_rows = conn.execute(
            """
            SELECT
              COALESCE(NULLIF(lower(btrim(local_plantio)), ''), 'Não informado') AS local_plantio,
              count(*)::int AS n
            FROM trees
            GROUP BY 1
            ORDER BY n DESC
            LIMIT 8
            """
        ).fetchall()

    per_bairro_species: dict[int, Counter] = {}
    per_bairro_scientific: dict[int, dict[str, str]] = {}
    per_bairro_total: Counter = Counter()
    per_bairro_unidentified: Counter = Counter()

    for row in matched_rows:
        b_id = int(row["bairro_id"])
        t_id = int(row["tree_id"])
        tree_to_bairro[t_id] = b_id
        per_bairro_total[b_id] += 1

        pop = clean_species(row["nome_popular"])
        sci = clean_species(row["nome_cientifico"])
        if pop:
            norm_pop = pop.title()
            per_bairro_species.setdefault(b_id, Counter())[norm_pop] += 1
            if sci and norm_pop not in per_bairro_scientific.setdefault(b_id, {}):
                per_bairro_scientific[b_id][norm_pop] = sci
        else:
            per_bairro_unidentified[b_id] += 1

    # Enrich each bairro feature
    bairro_summaries = []
    for feature in features:
        props = feature["properties"]
        b_id = int(props["ID"])
        count = int(props.get("TREE_COUNT") or per_bairro_total.get(b_id, 0))
        area = float(props.get("AREA_KM2") or 0)
        density = float(props.get("TREES_PER_KM2") or (count / area if area > 0 else 0))

        sp_counter = per_bairro_species.get(b_id, Counter())
        species_count = len(sp_counter)
        shannon = shannon_diversity(sp_counter)
        unid = per_bairro_unidentified.get(b_id, 0)
        unid_pct = round((unid * 100.0) / count, 1) if count > 0 else 0.0

        if sp_counter:
            top_name, top_count = sp_counter.most_common(1)[0]
            top_sci = per_bairro_scientific.get(b_id, {}).get(top_name)
            identified_in_bairro = sum(sp_counter.values())
            top_share_pct = (
                round((top_count * 100.0) / identified_in_bairro, 1)
                if identified_in_bairro > 0
                else 0.0
            )
            top5 = [
                {
                    "nomePopular": name,
                    "nomeCientifico": per_bairro_scientific.get(b_id, {}).get(name),
                    "count": cnt,
                    "sharePct": round((cnt * 100.0) / identified_in_bairro, 1)
                    if identified_in_bairro > 0
                    else 0.0,
                }
                for name, cnt in sp_counter.most_common(5)
            ]
        else:
            top_name = None
            top_sci = None
            top_count = 0
            top_share_pct = 0.0
            top5 = []

        bbox = geom_bbox(feature["geometry"])
        props["SPECIES_COUNT"] = species_count
        props["SHANNON_INDEX"] = shannon
        props["TOP_SPECIES"] = top_name
        props["TOP_SPECIES_SCIENTIFIC"] = top_sci
        props["TOP_SPECIES_COUNT"] = top_count
        props["TOP_SPECIES_SHARE"] = top_share_pct
        props["UNIDENTIFIED_PCT"] = unid_pct
        if bbox:
            props["BBOX"] = bbox

        bairro_summaries.append(
            {
                "id": b_id,
                "nome": props["NOME"],
                "treeCount": count,
                "areaKm2": round(area, 4),
                "treesPerKm2": round(density, 2),
                "speciesCount": species_count,
                "shannonIndex": shannon,
                "topSpecies": top_name,
                "topSpeciesScientific": top_sci,
                "topSpeciesCount": top_count,
                "topSpeciesShare": top_share_pct,
                "unidentifiedPct": unid_pct,
                "bbox": bbox,
                "topSpeciesList": top5,
            }
        )

    # Aggregate citywide species statistics
    total_trees = int(all_trees_rows["total_trees"])
    city_counter: Counter = Counter()
    city_sci: dict[str, str] = {}
    identified_trees = 0

    for row in city_species_rows:
        pop = clean_species(row["nome_popular"])
        sci = clean_species(row["nome_cientifico"])
        n = int(row["n"])
        if pop:
            norm = pop.title()
            city_counter[norm] += n
            identified_trees += n
            if sci and norm not in city_sci:
                city_sci[norm] = sci

    top_species_city = [
        {
            "nomePopular": name,
            "nomeCientifico": city_sci.get(name),
            "count": cnt,
            "sharePct": round((cnt * 100.0) / identified_trees, 2)
            if identified_trees > 0
            else 0.0,
            "totalSharePct": round((cnt * 100.0) / total_trees, 2)
            if total_trees > 0
            else 0.0,
        }
        for name, cnt in city_counter.most_common(25)
    ]

    total_area_km2 = sum(b["areaKm2"] for b in bairro_summaries)
    total_clipped_trees = sum(b["treeCount"] for b in bairro_summaries)

    summary = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "kpis": {
            "totalTrees": total_trees,
            "treesInBairros": total_clipped_trees,
            "identifiedTrees": identified_trees,
            "unidentifiedPct": round(
                ((total_trees - identified_trees) * 100.0) / total_trees, 1
            )
            if total_trees > 0
            else 0.0,
            "popularSpeciesCount": len(city_counter),
            "totalAreaKm2": round(total_area_km2, 2),
            "avgTreesPerKm2": round(total_clipped_trees / total_area_km2, 1)
            if total_area_km2 > 0
            else 0.0,
            "totalBairros": len(bairro_summaries),
        },
        "topSpecies": top_species_city,
        "plantingLocations": [
            {
                "label": r["local_plantio"][:1].upper() + r["local_plantio"][1:],
                "count": int(r["n"]),
            }
            for r in planting_rows
        ],
        "bairros": bairro_summaries,
    }

    BAIRRO_DENSITY_PATH.write_text(
        json.dumps(density_geojson, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    ANALYTICS_SUMMARY_PATH.write_text(
        json.dumps(summary, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    elapsed = time.time() - started
    print(
        f"Enriched {len(features)} bairros and {len(top_species_city)} top species in {elapsed:.1f}s."
    )
    print(f"  Updated: {BAIRRO_DENSITY_PATH}")
    print(f"  Wrote:   {ANALYTICS_SUMMARY_PATH}")
    return density_geojson, summary, tree_to_bairro


def upload_to_supabase(
    supabase_url: str,
    density_geojson: dict,
    summary: dict,
    tree_to_bairro: dict[int, int],
) -> None:
    started = time.time()
    print("Connecting to Supabase PostgreSQL...")
    with psycopg.connect(supabase_url, row_factory=dict_row, autocommit=True) as remote:
        print("Applying db/supabase_migration.sql...")
        remote.execute(MIGRATION_SQL_PATH.read_text(encoding="utf-8"))

        print("Uploading bairros_stats...")
        bairros_by_id = {b["id"]: b for b in summary["bairros"]}
        with remote.cursor() as cur:
            cur.execute("TRUNCATE public.bairros_stats;")
            for feature in density_geojson.get("features", []):
                b_id = int(feature["properties"]["ID"])
                b_info = bairros_by_id.get(b_id, {})
                cur.execute(
                    """
                    INSERT INTO public.bairros_stats (
                      id, nome, area_util_km2, tree_count, trees_per_km2,
                      species_count, shannon_index, top_species,
                      top_species_scientific, top_species_count,
                      top_species_pct, unidentified_pct, bbox, geom
                    )
                    VALUES (
                      %s, %s, %s, %s, %s,
                      %s, %s, %s,
                      %s, %s,
                      %s, %s, %s,
                      ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
                    )
                    """,
                    (
                        b_id,
                        feature["properties"]["NOME"],
                        b_info.get("areaKm2", 0),
                        b_info.get("treeCount", 0),
                        b_info.get("treesPerKm2", 0),
                        b_info.get("speciesCount", 0),
                        b_info.get("shannonIndex", 0),
                        b_info.get("topSpecies"),
                        b_info.get("topSpeciesScientific"),
                        b_info.get("topSpeciesCount", 0),
                        b_info.get("topSpeciesShare", 0),
                        b_info.get("unidentifiedPct", 0),
                        b_info.get("bbox"),
                        json.dumps(feature["geometry"]),
                    ),
                )

        print("Streaming ~300k trees from local PostGIS to Supabase via COPY...")
        with connect_local() as local_conn:
            rows = local_conn.execute(
                """
                SELECT
                  id,
                  id_arvore_siia,
                  ST_AsEWKT(geom) AS geom_ewkt,
                  utm_x_sirgas_2000,
                  utm_y_sirgas_2000,
                  tipo_individuo,
                  local_plantio,
                  logradouro_referencia,
                  numero_referencia,
                  local_referencia,
                  nome_cientifico,
                  nome_popular,
                  data_levantamento,
                  orgao_levantamento,
                  cep,
                  observacoes,
                  class_especial,
                  novo_plantio,
                  responsavel,
                  foto_url
                FROM trees
                ORDER BY id
                """
            ).fetchall()

        with remote.cursor() as cur:
            cur.execute("TRUNCATE public.trees CASCADE;")
            copy_sql = """
                COPY public.trees (
                  id, id_arvore_siia, geom, bairro_id,
                  utm_x_sirgas_2000, utm_y_sirgas_2000,
                  tipo_individuo, local_plantio, logradouro_referencia,
                  numero_referencia, local_referencia, nome_cientifico,
                  nome_popular, data_levantamento, orgao_levantamento,
                  cep, observacoes, class_especial, novo_plantio,
                  responsavel, foto_url
                ) FROM STDIN
            """
            with cur.copy(copy_sql) as copy:
                for row in rows:
                    t_id = int(row["id"])
                    copy.write_row(
                        (
                            t_id,
                            row["id_arvore_siia"],
                            row["geom_ewkt"],
                            tree_to_bairro.get(t_id),
                            row["utm_x_sirgas_2000"],
                            row["utm_y_sirgas_2000"],
                            row["tipo_individuo"],
                            row["local_plantio"],
                            row["logradouro_referencia"],
                            row["numero_referencia"],
                            row["local_referencia"],
                            row["nome_cientifico"],
                            row["nome_popular"],
                            row["data_levantamento"],
                            row["orgao_levantamento"],
                            row["cep"],
                            row["observacoes"],
                            row["class_especial"],
                            row["novo_plantio"],
                            row["responsavel"],
                            row["foto_url"],
                        )
                    )

            cur.execute(
                """
                SELECT setval(
                  'public.trees_id_seq',
                  GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.trees), 1)
                );
                """
            )
            cur.execute("ANALYZE public.trees;")
            cur.execute("ANALYZE public.bairros_stats;")

    elapsed = time.time() - started
    print(f"Uploaded {len(rows)} trees and {len(bairros_by_id)} bairros to Supabase in {elapsed:.1f}s.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Enrich local bairro analytics and/or upload inventory to Supabase."
    )
    parser.add_argument(
        "--enrich-local",
        action="store_true",
        help="Enrich public/data/bairro_tree_density.geojson and write analytics_summary.json.",
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="Run migration and upload all trees + bairros_stats to SUPABASE_DB_URL.",
    )
    args = parser.parse_args()

    density_geojson, summary, tree_to_bairro = enrich_from_local_db()

    if args.upload:
        supabase_url = os.environ.get("SUPABASE_DB_URL")
        if not supabase_url:
            sys.exit(
                "Missing SUPABASE_DB_URL environment variable. Set it to your Supabase Postgres URI and re-run with --upload."
            )
        upload_to_supabase(supabase_url, density_geojson, summary, tree_to_bairro)


if __name__ == "__main__":
    main()
