"""Load public/data/Arvores.geojson into the trees table.

Reads connection settings from db/.env. Refuses to replace an existing
inventory unless you pass --replace.
"""

import argparse
import csv
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = Path(__file__).resolve().parent / ".env"
GEOJSON = ROOT / "public" / "data" / "Arvores.geojson"

DATE_FORMATS = (
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d",
)

STAGING_COLUMNS = [
    "id",
    "id_arvore_siia",
    "lon",
    "lat",
    "utm_x_sirgas_2000",
    "utm_y_sirgas_2000",
    "tipo_individuo",
    "local_plantio",
    "logradouro_referencia",
    "numero_referencia",
    "local_referencia",
    "nome_cientifico",
    "nome_popular",
    "data_levantamento",
    "orgao_levantamento",
]


def load_env(path: Path) -> None:
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def as_int(value):
    if value is None or value == "":
        return None
    return int(value)


def as_float(value):
    if value is None or value == "":
        return None
    return float(value)


def as_text(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def as_timestamp(value):
    text = as_text(value)
    if text is None:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return None


def psql(sql: str) -> str:
    pgbin = os.environ["PGBIN"]
    result = subprocess.run(
        [
            str(Path(pgbin) / "psql.exe"),
            "-h",
            os.environ["PGHOST"],
            "-p",
            os.environ["PGPORT"],
            "-U",
            os.environ["PGUSER"],
            "-d",
            os.environ["PGDATABASE"],
            "-v",
            "ON_ERROR_STOP=1",
            "-At",
            "-c",
            sql,
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result.stdout.strip()


def copy_csv(csv_path: Path) -> None:
    pgbin = os.environ["PGBIN"]
    copy_sql = (
        "\\copy trees_load ("
        + ", ".join(STAGING_COLUMNS)
        + ") FROM '"
        + csv_path.as_posix()
        + "' WITH (FORMAT csv, NULL '\\N')"
    )
    subprocess.run(
        [
            str(Path(pgbin) / "psql.exe"),
            "-h",
            os.environ["PGHOST"],
            "-p",
            os.environ["PGPORT"],
            "-U",
            os.environ["PGUSER"],
            "-d",
            os.environ["PGDATABASE"],
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            copy_sql,
        ],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete trees already in the database before loading.",
    )
    args = parser.parse_args()

    if not ENV_FILE.exists():
        sys.exit(f"Missing {ENV_FILE}")
    if not GEOJSON.exists():
        sys.exit(f"Missing {GEOJSON}")

    load_env(ENV_FILE)

    existing = int(psql("SELECT count(*) FROM trees;"))
    if existing and not args.replace:
        sys.exit(
            f"trees already has {existing} rows. Re-run with --replace to reload from GeoJSON."
        )

    print(f"Reading {GEOJSON} ...", flush=True)
    with GEOJSON.open(encoding="utf-8") as handle:
        collection = json.load(handle)

    skipped = 0
    bad_dates = 0
    rows = []
    for feature in collection.get("features", []):
        props = feature.get("properties") or {}
        coords = (feature.get("geometry") or {}).get("coordinates") or []
        tree_id = as_int(props.get("ID"))
        if tree_id is None or len(coords) < 2:
            skipped += 1
            continue
        lon = as_float(coords[0])
        lat = as_float(coords[1])
        if lon is None or lat is None or not (-180 <= lon <= 180 and -90 <= lat <= 90):
            skipped += 1
            continue
        raw_date = props.get("DATA_LEVANTAMENTO")
        parsed_date = as_timestamp(raw_date)
        if as_text(raw_date) and parsed_date is None:
            bad_dates += 1
        rows.append(
            [
                tree_id,
                as_int(props.get("ID_ARVORE_SIIA")),
                lon,
                lat,
                as_float(props.get("UTM_X_SIRGAS_2000")),
                as_float(props.get("UTM_Y_SIRGAS_2000")),
                as_text(props.get("TIPO_INDIVIDUO")),
                as_text(props.get("LOCAL_PLANTIO")),
                as_text(props.get("LOGRADOURO_REFERENCIA")),
                as_text(props.get("NUMERO_REFERENCIA")),
                as_text(props.get("LOCAL_REFERENCIA")),
                as_text(props.get("NOME_CIENTIFICO")),
                as_text(props.get("NOME_POPULAR")),
                parsed_date,
                as_text(props.get("ORGAO_LEVANTAMENTO")),
            ]
        )

    print(f"Prepared {len(rows)} trees ({skipped} skipped, {bad_dates} unparsed dates).", flush=True)

    psql(
        """
        DROP TABLE IF EXISTS trees_load;
        CREATE UNLOGGED TABLE trees_load (
          id integer,
          id_arvore_siia bigint,
          lon double precision,
          lat double precision,
          utm_x_sirgas_2000 double precision,
          utm_y_sirgas_2000 double precision,
          tipo_individuo text,
          local_plantio text,
          logradouro_referencia text,
          numero_referencia text,
          local_referencia text,
          nome_cientifico text,
          nome_popular text,
          data_levantamento timestamp,
          orgao_levantamento text
        );
        """
    )
    if args.replace:
        psql("TRUNCATE trees;")

    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="", suffix=".csv", delete=False
    ) as handle:
        csv_path = Path(handle.name)
        writer = csv.writer(handle, lineterminator="\n")
        for row in rows:
            writer.writerow([r"\N" if value is None else value for value in row])

    try:
        print("Copying into PostgreSQL ...", flush=True)
        copy_csv(csv_path)
    finally:
        csv_path.unlink(missing_ok=True)

    inserted = psql(
        """
        WITH picked AS (
          SELECT DISTINCT ON (id) *
          FROM trees_load
          ORDER BY id, data_levantamento DESC NULLS LAST
        ),
        written AS (
          INSERT INTO trees (
            id,
            id_arvore_siia,
            geom,
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
            orgao_levantamento
          )
          SELECT
            id,
            id_arvore_siia,
            ST_SetSRID(ST_MakePoint(lon, lat), 4326),
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
            orgao_levantamento
          FROM picked
          RETURNING 1
        )
        SELECT count(*) FROM written;
        """
    )
    psql("DROP TABLE trees_load;")
    psql(
        """
        SELECT setval(
          'trees_id_seq',
          GREATEST((SELECT COALESCE(MAX(id), 1) FROM trees), 1)
        );
        """
    )
    psql("ANALYZE trees;")
    summary = psql(
        """
        SELECT count(*) || ' trees, ' || ST_Extent(geom)::text
        FROM trees;
        """
    )
    print(f"Loaded {inserted} trees.")
    print(summary)


if __name__ == "__main__":
    main()
