-- Supabase + PostGIS schema, spatial RPCs, analytics RPCs, and RLS policies
-- for the GDU RMBH Urban Forest Digital Twin.

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Core tables
CREATE TABLE IF NOT EXISTS public.trees (
  id integer PRIMARY KEY,
  id_arvore_siia bigint,
  geom geometry(Point, 4326) NOT NULL,
  bairro_id integer,
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
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.trees_id_seq OWNED BY public.trees.id;

ALTER TABLE public.trees
  ALTER COLUMN id SET DEFAULT nextval('public.trees_id_seq');

CREATE INDEX IF NOT EXISTS trees_geom_gix ON public.trees USING GIST (geom);
CREATE INDEX IF NOT EXISTS trees_bairro_id_idx ON public.trees (bairro_id);
CREATE INDEX IF NOT EXISTS trees_nome_popular_idx ON public.trees (nome_popular);
CREATE INDEX IF NOT EXISTS trees_created_by_idx ON public.trees (created_by);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trees_set_updated_at ON public.trees;

CREATE TRIGGER trees_set_updated_at
BEFORE UPDATE ON public.trees
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Neighborhood analytics and clipped polygon geometry
CREATE TABLE IF NOT EXISTS public.bairros_stats (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  area_util_km2 double precision NOT NULL DEFAULT 0,
  tree_count integer NOT NULL DEFAULT 0,
  trees_per_km2 double precision NOT NULL DEFAULT 0,
  species_count integer NOT NULL DEFAULT 0,
  shannon_index double precision NOT NULL DEFAULT 0,
  top_species text,
  top_species_scientific text,
  top_species_count integer NOT NULL DEFAULT 0,
  top_species_pct double precision NOT NULL DEFAULT 0,
  unidentified_pct double precision NOT NULL DEFAULT 0,
  bbox double precision[],
  geom geometry(MultiPolygon, 4326),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bairros_stats_geom_gix ON public.bairros_stats USING GIST (geom);

-- Community tree reports (maintenance, missing tree, wrong info)
CREATE TABLE IF NOT EXISTS public.tree_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tree_id integer NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('missing', 'maintenance', 'wrong_info')),
  notes text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tree_reports_tree_id_idx ON public.tree_reports (tree_id);

-- 2. Row-Level Security (RLS)
ALTER TABLE public.trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tree_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access on trees" ON public.trees;
CREATE POLICY "Public read access on trees"
  ON public.trees FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert trees" ON public.trees;
CREATE POLICY "Authenticated users can insert trees"
  ON public.trees FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creators can update their trees" ON public.trees;
CREATE POLICY "Creators can update their trees"
  ON public.trees FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creators can delete their trees" ON public.trees;
CREATE POLICY "Creators can delete their trees"
  ON public.trees FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Public read access on bairros_stats" ON public.bairros_stats;
CREATE POLICY "Public read access on bairros_stats"
  ON public.bairros_stats FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read access on tree_reports" ON public.tree_reports;
CREATE POLICY "Public read access on tree_reports"
  ON public.tree_reports FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can submit tree reports" ON public.tree_reports;
CREATE POLICY "Authenticated users can submit tree reports"
  ON public.tree_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- 3. Storage bucket for tree photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tree-photos', 'tree-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read tree photos" ON storage.objects;
CREATE POLICY "Public read tree photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'tree-photos');

DROP POLICY IF EXISTS "Authenticated upload tree photos" ON storage.objects;
CREATE POLICY "Authenticated upload tree photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'tree-photos');

-- 4. Spatial & Analytics RPC Functions

-- Count trees inside a viewport bounding box (capped at 5000 for fast threshold checks)
CREATE OR REPLACE FUNCTION public.trees_count_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT count(*)::integer
  FROM (
    SELECT 1
    FROM public.trees
    WHERE geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    LIMIT 5000
  ) sub;
$$;

-- Fetch trees inside a viewport bounding box as a GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION public.trees_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_features integer DEFAULT 20000,
  species_filter text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH matched AS (
    SELECT
      id,
      geom,
      local_plantio,
      nome_popular
    FROM public.trees
    WHERE geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
      AND (
        species_filter IS NULL
        OR btrim(species_filter) = ''
        OR lower(COALESCE(nome_popular, '')) = lower(species_filter)
        OR lower(COALESCE(nome_cientifico, '')) = lower(species_filter)
      )
    LIMIT max_features
  )
  SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'truncated', (SELECT count(*) >= max_features FROM matched),
    'features', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(geom)::jsonb,
            'properties', jsonb_build_object(
              'ID', id,
              'LOCAL_PLANTIO', local_plantio,
              'NOME_POPULAR', nome_popular
            )
          )
        )
        FROM matched
      ),
      '[]'::jsonb
    )
  );
$$;

-- Serve trees as Mapbox Vector Tiles: GET /rest/v1/rpc/trees_mvt?z=&x=&y=
-- with "Accept: application/vnd.mapbox-vector-tile" (PostgREST 12+ media type handler).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'application/vnd.mapbox-vector-tile'
  ) THEN
    CREATE DOMAIN "application/vnd.mapbox-vector-tile" AS bytea;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trees_mvt(z integer, x integer, y integer)
RETURNS "application/vnd.mapbox-vector-tile"
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  env geometry := ST_TileEnvelope(z, x, y);
  tile bytea;
BEGIN
  PERFORM set_config(
    'response.headers',
    '[{"Cache-Control": "public, max-age=600"}]',
    true
  );

  SELECT ST_AsMVT(t, 'trees', 4096, 'geom', 'fid')
  INTO tile
  FROM (
    SELECT
      id AS fid,
      id AS "ID",
      nome_popular AS "NOME_POPULAR",
      local_plantio AS "LOCAL_PLANTIO",
      ST_AsMVTGeom(ST_Transform(geom, 3857), env, 4096, 16, true) AS geom
    FROM public.trees
    WHERE geom && ST_Transform(env, 4326)
  ) t;

  RETURN COALESCE(tile, ''::bytea);
END;
$$;

GRANT EXECUTE ON FUNCTION public.trees_mvt(integer, integer, integer) TO anon, authenticated;

-- Insert a new collaborative tree point and return its GeoJSON Feature
CREATE OR REPLACE FUNCTION public.insert_user_tree(
  lng double precision,
  lat double precision,
  p_nome_popular text DEFAULT NULL,
  p_nome_cientifico text DEFAULT NULL,
  p_local_plantio text DEFAULT NULL,
  p_logradouro_referencia text DEFAULT NULL,
  p_numero_referencia text DEFAULT NULL,
  p_cep text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_class_especial text DEFAULT NULL,
  p_novo_plantio text DEFAULT NULL,
  p_responsavel text DEFAULT NULL,
  p_foto_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_point geometry(Point, 4326);
  v_bairro_id integer;
  v_row public.trees%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária para cadastrar uma árvore.';
  END IF;

  v_point := ST_SetSRID(ST_MakePoint(lng, lat), 4326);

  SELECT b.id INTO v_bairro_id
  FROM public.bairros_stats b
  WHERE b.geom IS NOT NULL
    AND b.geom && v_point
    AND ST_CoveredBy(v_point, b.geom)
  LIMIT 1;

  INSERT INTO public.trees (
    geom,
    bairro_id,
    tipo_individuo,
    local_plantio,
    logradouro_referencia,
    numero_referencia,
    nome_cientifico,
    nome_popular,
    data_levantamento,
    orgao_levantamento,
    cep,
    observacoes,
    class_especial,
    novo_plantio,
    responsavel,
    foto_url,
    created_by
  )
  VALUES (
    v_point,
    v_bairro_id,
    'Árvore',
    NULLIF(btrim(p_local_plantio), ''),
    NULLIF(btrim(p_logradouro_referencia), ''),
    NULLIF(btrim(p_numero_referencia), ''),
    NULLIF(btrim(p_nome_cientifico), ''),
    NULLIF(btrim(p_nome_popular), ''),
    now(),
    'Colaborativo',
    NULLIF(btrim(p_cep), ''),
    NULLIF(btrim(p_observacoes), ''),
    NULLIF(btrim(p_class_especial), ''),
    NULLIF(btrim(p_novo_plantio), ''),
    NULLIF(btrim(p_responsavel), ''),
    NULLIF(btrim(p_foto_url), ''),
    v_user_id
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(v_row.geom)::jsonb,
    'properties', jsonb_build_object(
      'ID', v_row.id,
      'ID_ARVORE_SIIA', v_row.id_arvore_siia,
      'BAIRRO_ID', v_row.bairro_id,
      'TIPO_INDIVIDUO', v_row.tipo_individuo,
      'LOCAL_PLANTIO', v_row.local_plantio,
      'LOGRADOURO_REFERENCIA', v_row.logradouro_referencia,
      'NUMERO_REFERENCIA', v_row.numero_referencia,
      'NOME_CIENTIFICO', v_row.nome_cientifico,
      'NOME_POPULAR', v_row.nome_popular,
      'DATA_LEVANTAMENTO', v_row.data_levantamento,
      'ORGAO_LEVANTAMENTO', v_row.orgao_levantamento,
      'CEP', v_row.cep,
      'OBSERVACOES', v_row.observacoes,
      'CLASS_ESPECIAL', v_row.class_especial,
      'NOVO_PLANTIO', v_row.novo_plantio,
      'RESPONSAVEL', v_row.responsavel,
      'FOTO_URL', v_row.foto_url,
      'CREATED_BY', v_row.created_by
    )
  );
END;
$$;

-- Citywide + neighborhood + species summary for the Painel (Dashboard)
CREATE OR REPLACE FUNCTION public.dashboard_overview()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH totals AS (
    SELECT
      count(*)::integer AS total_trees,
      count(*) FILTER (
        WHERE nome_popular IS NOT NULL
          AND btrim(nome_popular) <> ''
          AND lower(btrim(nome_popular)) NOT IN ('sem identificação', 'nao identificada', 'não identificada', 'desconhecida', 'indeterminada')
      )::integer AS identified_trees,
      count(DISTINCT lower(btrim(nome_popular))) FILTER (
        WHERE nome_popular IS NOT NULL
          AND btrim(nome_popular) <> ''
          AND lower(btrim(nome_popular)) NOT IN ('sem identificação', 'nao identificada', 'não identificada', 'desconhecida', 'indeterminada')
      )::integer AS popular_species_count,
      count(DISTINCT lower(btrim(nome_cientifico))) FILTER (
        WHERE nome_cientifico IS NOT NULL
          AND btrim(nome_cientifico) <> ''
          AND lower(btrim(nome_cientifico)) NOT IN ('sem identificação', 'nao identificada', 'não identificada', 'desconhecida', 'indeterminada')
      )::integer AS scientific_species_count
    FROM public.trees
  ),
  area_totals AS (
    SELECT
      COALESCE(sum(area_util_km2), 0) AS total_area_km2,
      count(*)::integer AS total_bairros
    FROM public.bairros_stats
  ),
  top_sp AS (
    SELECT
      initcap(lower(btrim(nome_popular))) AS nome_popular,
      max(btrim(nome_cientifico)) AS nome_cientifico,
      count(*)::integer AS tree_count
    FROM public.trees
    WHERE nome_popular IS NOT NULL
      AND btrim(nome_popular) <> ''
      AND lower(btrim(nome_popular)) NOT IN ('sem identificação', 'nao identificada', 'não identificada', 'desconhecida', 'indeterminada')
    GROUP BY lower(btrim(nome_popular))
    ORDER BY count(*) DESC
    LIMIT 15
  )
  SELECT jsonb_build_object(
    'totalTrees', t.total_trees,
    'identifiedTrees', t.identified_trees,
    'unidentifiedPct', CASE WHEN t.total_trees > 0 THEN round(((t.total_trees - t.identified_trees)::numeric * 100.0) / t.total_trees, 1) ELSE 0 END,
    'popularSpeciesCount', t.popular_species_count,
    'scientificSpeciesCount', t.scientific_species_count,
    'totalAreaKm2', round(a.total_area_km2::numeric, 2),
    'avgTreesPerKm2', CASE WHEN a.total_area_km2 > 0 THEN round((t.total_trees / a.total_area_km2)::numeric, 1) ELSE 0 END,
    'totalBairros', a.total_bairros,
    'topSpecies', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'nomePopular', s.nome_popular,
            'nomeCientifico', s.nome_cientifico,
            'count', s.tree_count,
            'sharePct', CASE WHEN t.total_trees > 0 THEN round((s.tree_count::numeric * 100.0) / t.total_trees, 2) ELSE 0 END
          )
        )
        FROM top_sp s
      ),
      '[]'::jsonb
    )
  )
  FROM totals t
  CROSS JOIN area_totals a;
$$;

-- Suggested places for a future tree, reviewed by the responsible organizations.
CREATE TABLE IF NOT EXISTS public.planting_suggestions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  geom geometry(Point, 4326) NOT NULL,
  address text,
  logradouro text,
  numero text,
  cep text,
  local_plantio text,
  notes text,
  foto_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'planted', 'dismissed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planting_suggestions
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS local_plantio text,
  ADD COLUMN IF NOT EXISTS foto_url text;

CREATE INDEX IF NOT EXISTS planting_suggestions_geom_gix
  ON public.planting_suggestions USING GIST (geom);

ALTER TABLE public.planting_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read open planting suggestions" ON public.planting_suggestions;
CREATE POLICY "Public read open planting suggestions"
  ON public.planting_suggestions FOR SELECT
  TO anon, authenticated
  USING (status = 'open');

DROP POLICY IF EXISTS "Authenticated users suggest plantings" ON public.planting_suggestions;
CREATE POLICY "Authenticated users suggest plantings"
  ON public.planting_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP FUNCTION IF EXISTS public.insert_planting_suggestion(double precision, double precision, text, text);

CREATE OR REPLACE FUNCTION public.insert_planting_suggestion(
  lng double precision,
  lat double precision,
  p_notes text DEFAULT NULL,
  p_logradouro text DEFAULT NULL,
  p_numero text DEFAULT NULL,
  p_cep text DEFAULT NULL,
  p_local_plantio text DEFAULT NULL,
  p_foto_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.planting_suggestions%ROWTYPE;
  v_logradouro text := NULLIF(btrim(COALESCE(p_logradouro, '')), '');
  v_numero text := NULLIF(btrim(COALESCE(p_numero, '')), '');
  v_address text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária para indicar um local de plantio.';
  END IF;
  IF lng IS NULL OR lat IS NULL THEN
    RAISE EXCEPTION 'Escolha um ponto no mapa.';
  END IF;

  v_address := NULLIF(
    btrim(concat_ws(', ', v_logradouro, v_numero), ', '),
    ''
  );

  INSERT INTO public.planting_suggestions (
    geom, address, logradouro, numero, cep, local_plantio, notes, foto_url, created_by
  )
  VALUES (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326),
    v_address,
    v_logradouro,
    v_numero,
    NULLIF(btrim(COALESCE(p_cep, '')), ''),
    NULLIF(btrim(COALESCE(p_local_plantio, '')), ''),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    NULLIF(btrim(COALESCE(p_foto_url, '')), ''),
    v_user_id
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(v_row.geom)::jsonb,
    'properties', jsonb_build_object(
      'ID', v_row.id,
      'ADDRESS', v_row.address,
      'LOGRADOURO', v_row.logradouro,
      'NUMERO', v_row.numero,
      'CEP', v_row.cep,
      'LOCAL_PLANTIO', v_row.local_plantio,
      'NOTES', v_row.notes,
      'FOTO_URL', v_row.foto_url,
      'STATUS', v_row.status,
      'CREATED_AT', v_row.created_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.planting_suggestions_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(s.geom)::jsonb,
            'properties', jsonb_build_object(
              'ID', s.id,
              'ADDRESS', s.address,
              'LOGRADOURO', s.logradouro,
              'NUMERO', s.numero,
              'CEP', s.cep,
              'LOCAL_PLANTIO', s.local_plantio,
              'NOTES', s.notes,
              'FOTO_URL', s.foto_url,
              'STATUS', s.status,
              'CREATED_AT', s.created_at
            )
          )
          ORDER BY s.created_at DESC
        )
        FROM (
          SELECT *
          FROM public.planting_suggestions
          WHERE status = 'open'
            AND geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
          ORDER BY created_at DESC
          LIMIT 500
        ) AS s
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.insert_planting_suggestion(double precision, double precision, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_planting_suggestion(double precision, double precision, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planting_suggestions_in_bbox(double precision, double precision, double precision, double precision) TO anon, authenticated;

-- Place-based problem reports, with a reference address and an optional photo.
CREATE TABLE IF NOT EXISTS public.problem_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  geom geometry(Point, 4326) NOT NULL,
  tree_id integer REFERENCES public.trees(id) ON DELETE SET NULL,
  report_type text NOT NULL CHECK (report_type IN ('missing', 'maintenance', 'wrong_info')),
  address text,
  logradouro text,
  numero text,
  cep text,
  local_plantio text,
  notes text,
  foto_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS problem_reports_geom_gix
  ON public.problem_reports USING GIST (geom);

ALTER TABLE public.problem_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read open problem reports" ON public.problem_reports;
CREATE POLICY "Public read open problem reports"
  ON public.problem_reports FOR SELECT
  TO anon, authenticated
  USING (status = 'open');

DROP POLICY IF EXISTS "Authenticated users submit problem reports" ON public.problem_reports;
CREATE POLICY "Authenticated users submit problem reports"
  ON public.problem_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE OR REPLACE FUNCTION public.insert_problem_report(
  lng double precision,
  lat double precision,
  p_report_type text,
  p_notes text DEFAULT NULL,
  p_logradouro text DEFAULT NULL,
  p_numero text DEFAULT NULL,
  p_cep text DEFAULT NULL,
  p_local_plantio text DEFAULT NULL,
  p_foto_url text DEFAULT NULL,
  p_tree_id integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.problem_reports%ROWTYPE;
  v_logradouro text := NULLIF(btrim(COALESCE(p_logradouro, '')), '');
  v_numero text := NULLIF(btrim(COALESCE(p_numero, '')), '');
  v_address text;
  v_tree_id integer := p_tree_id;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária para relatar um problema.';
  END IF;
  IF lng IS NULL OR lat IS NULL THEN
    RAISE EXCEPTION 'Escolha um ponto no mapa.';
  END IF;
  IF p_report_type IS NULL OR p_report_type NOT IN ('missing', 'maintenance', 'wrong_info') THEN
    RAISE EXCEPTION 'Escolha o tipo de problema.';
  END IF;
  IF v_tree_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.trees WHERE id = v_tree_id
  ) THEN
    v_tree_id := NULL;
  END IF;

  v_address := NULLIF(
    btrim(concat_ws(', ', v_logradouro, v_numero), ', '),
    ''
  );

  INSERT INTO public.problem_reports (
    geom, tree_id, report_type, address, logradouro, numero, cep,
    local_plantio, notes, foto_url, created_by
  )
  VALUES (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326),
    v_tree_id,
    p_report_type,
    v_address,
    v_logradouro,
    v_numero,
    NULLIF(btrim(COALESCE(p_cep, '')), ''),
    NULLIF(btrim(COALESCE(p_local_plantio, '')), ''),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    NULLIF(btrim(COALESCE(p_foto_url, '')), ''),
    v_user_id
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(v_row.geom)::jsonb,
    'properties', jsonb_build_object(
      'ID', v_row.id,
      'TREE_ID', v_row.tree_id,
      'REPORT_TYPE', v_row.report_type,
      'ADDRESS', v_row.address,
      'LOGRADOURO', v_row.logradouro,
      'NUMERO', v_row.numero,
      'CEP', v_row.cep,
      'LOCAL_PLANTIO', v_row.local_plantio,
      'NOTES', v_row.notes,
      'FOTO_URL', v_row.foto_url,
      'STATUS', v_row.status,
      'CREATED_AT', v_row.created_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.problem_reports_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(s.geom)::jsonb,
            'properties', jsonb_build_object(
              'ID', s.id,
              'TREE_ID', s.tree_id,
              'REPORT_TYPE', s.report_type,
              'ADDRESS', s.address,
              'LOGRADOURO', s.logradouro,
              'NUMERO', s.numero,
              'CEP', s.cep,
              'LOCAL_PLANTIO', s.local_plantio,
              'NOTES', s.notes,
              'FOTO_URL', s.foto_url,
              'STATUS', s.status,
              'CREATED_AT', s.created_at
            )
          )
          ORDER BY s.created_at DESC
        )
        FROM (
          SELECT *
          FROM public.problem_reports
          WHERE status = 'open'
            AND geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
          ORDER BY created_at DESC
          LIMIT 500
        ) AS s
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.insert_problem_report(double precision, double precision, text, text, text, text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_problem_report(double precision, double precision, text, text, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.problem_reports_in_bbox(double precision, double precision, double precision, double precision) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
