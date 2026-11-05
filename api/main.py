"""Viewport API for the GDU RMBH tree inventory."""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from api.db import connect

app = FastAPI(title="GDU RMBH Trees")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    with connect() as conn:
        row = conn.execute("SELECT postgis_version() AS postgis").fetchone()
    return {"ok": True, "postgis": row["postgis"]}


@app.get("/api/trees/count")
def trees_count(
    min_lng: float = Query(..., ge=-180, le=180),
    min_lat: float = Query(..., ge=-90, le=90),
    max_lng: float = Query(..., ge=-180, le=180),
    max_lat: float = Query(..., ge=-90, le=90),
):
    if min_lng >= max_lng or min_lat >= max_lat:
        raise HTTPException(
            status_code=422,
            detail="min_lng and min_lat must be less than max_lng and max_lat.",
        )

    with connect() as conn:
        row = conn.execute(
            """
            SELECT count(*)::int AS n
            FROM trees
            WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
            """,
            (min_lng, min_lat, max_lng, max_lat),
        ).fetchone()
    return {"count": row["n"]}


@app.get("/api/trees")
def trees_in_view(
    min_lng: float = Query(..., ge=-180, le=180),
    min_lat: float = Query(..., ge=-90, le=90),
    max_lng: float = Query(..., ge=-180, le=180),
    max_lat: float = Query(..., ge=-90, le=90),
    limit: int = Query(20000, ge=1, le=20000),
):
    if min_lng >= max_lng or min_lat >= max_lat:
        raise HTTPException(
            status_code=422,
            detail="min_lng and min_lat must be less than max_lng and max_lat.",
        )

    with connect() as conn:
        row = conn.execute(
            "SELECT trees_in_bbox(%s, %s, %s, %s, %s) AS collection",
            (min_lng, min_lat, max_lng, max_lat, limit),
        ).fetchone()

    collection = row["collection"]
    features = collection.get("features") or []
    collection["truncated"] = len(features) >= limit
    return collection


@app.get("/api/trees/{tree_id}")
def tree_by_id(tree_id: int):
    with connect() as conn:
        row = conn.execute(
            """
            SELECT
              id,
              id_arvore_siia,
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
            WHERE id = %s
            """,
            (tree_id,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Tree not found")

    surveyed = row["data_levantamento"]
    return {
        "ID": row["id"],
        "ID_ARVORE_SIIA": row["id_arvore_siia"],
        "UTM_X_SIRGAS_2000": row["utm_x_sirgas_2000"],
        "UTM_Y_SIRGAS_2000": row["utm_y_sirgas_2000"],
        "TIPO_INDIVIDUO": row["tipo_individuo"],
        "LOCAL_PLANTIO": row["local_plantio"],
        "LOGRADOURO_REFERENCIA": row["logradouro_referencia"],
        "NUMERO_REFERENCIA": row["numero_referencia"],
        "LOCAL_REFERENCIA": row["local_referencia"],
        "NOME_CIENTIFICO": row["nome_cientifico"],
        "NOME_POPULAR": row["nome_popular"],
        "DATA_LEVANTAMENTO": surveyed.isoformat() if surveyed else None,
        "ORGAO_LEVANTAMENTO": row["orgao_levantamento"],
        "CEP": row["cep"],
        "OBSERVACOES": row["observacoes"],
        "CLASS_ESPECIAL": row["class_especial"],
        "NOVO_PLANTIO": row["novo_plantio"],
        "RESPONSAVEL": row["responsavel"],
        "FOTO_URL": row["foto_url"],
        "CREATED_BY": None,
    }


@app.get("/api/analytics")
def analytics_overview():
    from pathlib import Path
    import json

    summary_path = Path(__file__).resolve().parents[1] / "public" / "data" / "analytics_summary.json"
    if summary_path.exists():
        return json.loads(summary_path.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="Analytics summary not generated yet.")

