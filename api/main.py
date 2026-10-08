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
