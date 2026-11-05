"""Count trees inside each Belo Horizonte bairro and write a choropleth.

Reads public/data/bairros.geojson (PBH Bairro Popular, WGS84) and the trees
table. Parks, forest reserves, the Pampulha lagoon, and large non-street
uses from the 2022 land-use layer are removed before the area and the
density are calculated. Permanent preservation areas stay in the bairro.
Writes public/data/bairro_tree_density.geojson for the map.
"""

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.db import connect

RAW_DATA = ROOT / "db" / "raw_data"
PUBLIC_DATA = ROOT / "public" / "data"
SOURCE = RAW_DATA / "bairros.geojson"
PARKS = RAW_DATA / "parques.geojson"
RESERVES = RAW_DATA / "unidades_conservacao.geojson"
LAND_USE = RAW_DATA / "uso_ocupacao_especial.geojson"
LAGOON = RAW_DATA / "lagoa_pampulha.geojson"
CEMETERIES = (
    RAW_DATA / "cemiterio_publico.geojson",
    RAW_DATA / "cemiterio_particular.geojson",
)
AIRPORT = RAW_DATA / "pista_aeroporto.geojson"
OUTPUT = PUBLIC_DATA / "bairro_tree_density.geojson"
SIMPLIFY_DEGREES = 0.0001
RESERVE_CATEGORIES = {"PRQ", "RPE", "RPPN", "ESEC", "APE"}
MIN_AREA_KM2 = 0.002
# Square meters. Schools, sheds, and gyms below these sizes stay in the bairro.
LARGE_SHED_M2 = 10_000
LARGE_STADIUM_M2 = 10_000
CAMPUS_M2 = 50_000
LARGE_PUBLIC_FACILITY_M2 = 80_000
ALWAYS_EXCLUDE = {"CLUBE ESPORTIVO/SOCIAL", "AEROPORTO", "CEMITERIO"}
LARGE_SHEDS = {"GALPAO COMERCIAL", "GALPAO INDUSTRIAL"}


def geometries_from(path: Path, keep=None):
    geojson = json.loads(path.read_text(encoding="utf-8"))
    for feature in geojson["features"]:
        if keep is not None and not keep(feature):
            continue
        geometry = feature.get("geometry")
        if geometry:
            yield json.dumps(geometry)


def main() -> None:
    geojson = json.loads(SOURCE.read_text(encoding="utf-8"))
    rows = []
    for feature in geojson["features"]:
        props = feature["properties"]
        area = props.get("AREA_KM2")
        rows.append(
            (
                int(props["ID"]),
                props["NOME"],
                float(area) if area not in (None, "") else None,
                json.dumps(feature["geometry"]),
            )
        )

    started = time.time()
    with connect() as conn:
        conn.execute(
            """
            CREATE TEMP TABLE bairro_load (
              id integer PRIMARY KEY,
              nome text NOT NULL,
              area_km2 double precision,
              geom geometry(Geometry, 4326) NOT NULL
            )
            """
        )
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO bairro_load (id, nome, area_km2, geom)
                VALUES (
                  %s,
                  %s,
                  %s,
                  ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
                )
                """,
                rows,
            )
        conn.execute("CREATE INDEX bairro_load_gix ON bairro_load USING GIST (geom)")
        conn.execute("ANALYZE bairro_load")

        conn.execute(
            """
            CREATE TEMP TABLE green_load (
              geom geometry(Geometry, 4326) NOT NULL
            )
            """
        )
        green = []
        green.extend(geometries_from(PARKS))
        green.extend(
            geometries_from(
                RESERVES,
                lambda feature: feature["properties"].get("CATEGORIA")
                in RESERVE_CATEGORIES,
            )
        )
        green.extend(geometries_from(LAGOON))
        green.extend(geometries_from(AIRPORT))
        for path in CEMETERIES:
            green.extend(geometries_from(path))
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO green_load (geom)
                VALUES (ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
                """,
                [(geometry,) for geometry in green],
            )

        uso_rows = []
        for feature in json.loads(LAND_USE.read_text(encoding="utf-8"))["features"]:
            geometry = feature.get("geometry")
            if not geometry:
                continue
            uso_rows.append(
                (
                    feature["properties"].get("TIPOLOGIA_OCUPACAO"),
                    json.dumps(geometry),
                )
            )
        conn.execute(
            """
            CREATE TEMP TABLE uso_load (
              ocup text,
              geom geometry(Geometry, 4326)
            )
            """
        )
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO uso_load (ocup, geom)
                VALUES (%s, ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
                """,
                uso_rows,
            )
        included = conn.execute(
            """
            INSERT INTO green_load (geom)
            SELECT geom
            FROM uso_load
            WHERE ocup = ANY(%s)
               OR (ocup = ANY(%s) AND ST_Area(geom::geography) >= %s)
               OR (ocup = 'ESTADIO/GINASIO' AND ST_Area(geom::geography) >= %s)
               OR (ocup = 'INSTITUICAO DE ENSINO' AND ST_Area(geom::geography) >= %s)
               OR (ocup = 'SERVICOS PUBLICOS' AND ST_Area(geom::geography) >= %s)
            RETURNING 1
            """,
            (
                list(ALWAYS_EXCLUDE),
                list(LARGE_SHEDS),
                LARGE_SHED_M2,
                LARGE_STADIUM_M2,
                CAMPUS_M2,
                LARGE_PUBLIC_FACILITY_M2,
            ),
        ).fetchall()
        print(f"land-use exclusions: {len(included)}")
        breakdown = conn.execute(
            """
            SELECT ocup, count(*) AS n
            FROM uso_load
            WHERE ocup = ANY(%s)
               OR (ocup = ANY(%s) AND ST_Area(geom::geography) >= %s)
               OR (ocup = 'ESTADIO/GINASIO' AND ST_Area(geom::geography) >= %s)
               OR (ocup = 'INSTITUICAO DE ENSINO' AND ST_Area(geom::geography) >= %s)
               OR (ocup = 'SERVICOS PUBLICOS' AND ST_Area(geom::geography) >= %s)
            GROUP BY ocup
            ORDER BY n DESC
            """,
            (
                list(ALWAYS_EXCLUDE),
                list(LARGE_SHEDS),
                LARGE_SHED_M2,
                LARGE_STADIUM_M2,
                CAMPUS_M2,
                LARGE_PUBLIC_FACILITY_M2,
            ),
        ).fetchall()
        for row in breakdown:
            print(f"  {row['ocup']}: {row['n']}")

        conn.execute("CREATE INDEX green_load_gix ON green_load USING GIST (geom)")
        conn.execute(
            """
            CREATE TEMP TABLE green_parts AS
            SELECT ST_Subdivide(geom, 64) AS geom
            FROM green_load
            WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
            """
        )
        conn.execute("CREATE INDEX green_parts_gix ON green_parts USING GIST (geom)")
        conn.execute("ANALYZE green_parts")

        counted = conn.execute(
            """
            WITH clipped AS (
              SELECT
                b.id,
                b.nome,
                ST_Multi(
                  ST_CollectionExtract(
                    ST_MakeValid(
                      CASE
                        WHEN g.geom IS NULL THEN b.geom
                        ELSE ST_Difference(b.geom, g.geom)
                      END
                    ),
                    3
                  )
                ) AS geom
              FROM bairro_load b
              LEFT JOIN LATERAL (
                SELECT ST_Union(p.geom) AS geom
                FROM green_parts p
                WHERE p.geom && b.geom
                  AND ST_Intersects(p.geom, b.geom)
              ) g ON true
            )
            SELECT
              c.id,
              c.nome,
              ST_Area(c.geom::geography) / 1000000.0 AS area_km2,
              (
                SELECT count(*)::int
                FROM trees t
                WHERE t.geom && c.geom
                  AND ST_CoveredBy(t.geom, c.geom)
              ) AS tree_count,
              ST_AsGeoJSON(
                ST_SimplifyPreserveTopology(c.geom, %s)
              ) AS geometry
            FROM clipped c
            WHERE c.geom IS NOT NULL
              AND NOT ST_IsEmpty(c.geom)
              AND ST_Area(c.geom::geography) / 1000000.0 >= %s
            ORDER BY c.nome
            """,
            (SIMPLIFY_DEGREES, MIN_AREA_KM2),
        ).fetchall()

    features = []
    for row in counted:
        area = float(row["area_km2"] or 0)
        count = int(row["tree_count"])
        density = count / area if area > 0 else 0
        features.append(
            {
                "type": "Feature",
                "id": row["id"],
                "geometry": json.loads(row["geometry"]),
                "properties": {
                    "ID": row["id"],
                    "NOME": row["nome"],
                    "TREE_COUNT": count,
                    "AREA_KM2": round(area, 4),
                    "TREES_PER_KM2": round(density, 2),
                },
            }
        )

    collection = {"type": "FeatureCollection", "features": features}
    OUTPUT.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    densities = sorted(feature["properties"]["TREES_PER_KM2"] for feature in features)
    elapsed = time.time() - started
    print(
        f"wrote {len(features)} bairros, "
        f"{sum(feature['properties']['TREE_COUNT'] for feature in features)} trees, "
        f"density {densities[0]:.0f}–{densities[-1]:.0f} per km2, "
        f"{OUTPUT.stat().st_size} bytes, {elapsed:.1f}s"
    )


if __name__ == "__main__":
    main()
