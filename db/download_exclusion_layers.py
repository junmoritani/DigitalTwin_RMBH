"""Download BHMAP layers used to cut non-street land out of bairro density."""

import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "db" / "raw_data"
DATA.mkdir(parents=True, exist_ok=True)
WFS = "https://bhmap.pbh.gov.br/v2/api/idebhgeo/wfs"

OCCUPATIONS = [
    "CLUBE ESPORTIVO/SOCIAL",
    "AEROPORTO",
    "CEMITERIO",
    "ESTADIO/GINASIO",
    "GALPAO COMERCIAL",
    "GALPAO INDUSTRIAL",
    "INSTITUICAO DE ENSINO",
    "SERVICOS PUBLICOS",
]


def fetch(type_name, dest, cql=None):
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": f"ide_bhgeo:{type_name}",
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",
    }
    if cql:
        params["CQL_FILTER"] = cql
    url = f"{WFS}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    print("get", type_name)
    with urllib.request.urlopen(request, timeout=300) as response, dest.open("wb") as handle:
        total = 0
        while True:
            chunk = response.read(1 << 20)
            if not chunk:
                break
            handle.write(chunk)
            total += len(chunk)
    print(type_name, total)


def main():
    features = []
    for occupation in OCCUPATIONS:
        safe = occupation.replace("/", "-").replace(" ", "_").lower()
        dest = DATA / f"uso_{safe}.geojson"
        fetch(
            "TIPOLOGIA_USO_OCUPACAO_LOTE_2022",
            dest,
            f"TIPOLOGIA_OCUPACAO='{occupation}'",
        )
        part = json.loads(dest.read_text(encoding="utf-8"))
        features.extend(part.get("features") or [])
        dest.unlink()
    collection = {"type": "FeatureCollection", "features": features}
    (DATA / "uso_ocupacao_especial.geojson").write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print("uso features", len(features))
    fetch("LAGOA_PAMPULHA", DATA / "lagoa_pampulha.geojson")
    fetch("CEMITERIO_PUBLICO", DATA / "cemiterio_publico.geojson")
    fetch("CEMITERIO_PARTICULAR", DATA / "cemiterio_particular.geojson")
    fetch("PISTA_AEROPORTO", DATA / "pista_aeroporto.geojson")


if __name__ == "__main__":
    main()
