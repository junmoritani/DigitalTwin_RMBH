-- Tree inventory for GDU RMBH.
-- Points are WGS84 (SRID 4326), matching Arvores.geojson.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS trees (
  id integer PRIMARY KEY,
  id_arvore_siia bigint,
  geom geometry(Point, 4326) NOT NULL,
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
  orgao_levantamento text,
  cep text,
  observacoes text,
  class_especial text,
  novo_plantio text,
  responsavel text,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS trees_id_seq OWNED BY trees.id;

ALTER TABLE trees
  ALTER COLUMN id SET DEFAULT nextval('trees_id_seq');

CREATE INDEX IF NOT EXISTS trees_geom_gix ON trees USING GIST (geom);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trees_set_updated_at ON trees;

CREATE TRIGGER trees_set_updated_at
BEFORE UPDATE ON trees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Trees inside a map view, as a GeoJSON FeatureCollection.
-- Property names match the fields the map already reads.
CREATE OR REPLACE FUNCTION trees_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_features integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
  )
  FROM (
    SELECT jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(geom)::jsonb,
      'properties', jsonb_build_object(
        'ID', id,
        'ID_ARVORE_SIIA', id_arvore_siia,
        'UTM_X_SIRGAS_2000', utm_x_sirgas_2000,
        'UTM_Y_SIRGAS_2000', utm_y_sirgas_2000,
        'TIPO_INDIVIDUO', tipo_individuo,
        'LOCAL_PLANTIO', local_plantio,
        'LOGRADOURO_REFERENCIA', logradouro_referencia,
        'NUMERO_REFERENCIA', numero_referencia,
        'LOCAL_REFERENCIA', local_referencia,
        'NOME_CIENTIFICO', nome_cientifico,
        'NOME_POPULAR', nome_popular,
        'DATA_LEVANTAMENTO', data_levantamento,
        'ORGAO_LEVANTAMENTO', orgao_levantamento,
        'CEP', cep,
        'OBSERVACOES', observacoes,
        'CLASS_ESPECIAL', class_especial,
        'NOVO_PLANTIO', novo_plantio,
        'RESPONSAVEL', responsavel,
        'FOTO_URL', foto_url
      )
    ) AS feature
    FROM trees
    WHERE geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    LIMIT max_features
  ) AS rows;
$$;
