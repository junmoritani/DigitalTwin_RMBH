import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

const TREE_TILES_PATH = "/rest/v1/rpc/trees_mvt";

export const treeTilesUrl = isSupabaseConfigured
  ? `${supabaseUrl}${TREE_TILES_PATH}?z={z}&x={x}&y={y}`
  : null;

export function transformTreeTileRequest(url) {
  if (!treeTilesUrl || !url.startsWith(`${supabaseUrl}${TREE_TILES_PATH}`)) {
    return undefined;
  }
  return {
    url,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: "application/vnd.mapbox-vector-tile",
    },
  };
}

function tileForLngLat(lng, lat, z) {
  const scale = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale
  );
  return { x, y, z };
}

export async function treeTilesAvailable(lng, lat, z) {
  if (!treeTilesUrl) return false;
  const tile = tileForLngLat(lng, lat, z);
  const url = treeTilesUrl
    .replace("{z}", tile.z)
    .replace("{x}", tile.x)
    .replace("{y}", tile.y);
  try {
    const request = transformTreeTileRequest(url);
    const response = await fetch(request.url, { headers: request.headers });
    return response.ok;
  } catch {
    return false;
  }
}

function viewParams(bounds) {
  return new URLSearchParams({
    min_lng: bounds.getWest(),
    min_lat: bounds.getSouth(),
    max_lng: bounds.getEast(),
    max_lat: bounds.getNorth(),
  });
}

export async function fetchTreesInView(bounds, signal, speciesFilter = null) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .rpc("trees_in_bbox", {
        min_lng: bounds.getWest(),
        min_lat: bounds.getSouth(),
        max_lng: bounds.getEast(),
        max_lat: bounds.getNorth(),
        max_features: 20000,
        species_filter: speciesFilter || null,
      })
      .abortSignal(signal);

    if (!error) {
      return data ?? { type: "FeatureCollection", features: [] };
    }
    console.warn("Supabase trees_in_bbox failed, trying local API:", error.message);
  }

  const response = await fetch(`/api/trees?${viewParams(bounds)}`, { signal });
  if (!response.ok) {
    throw new Error(`Tree API responded with ${response.status}`);
  }
  return response.json();
}

const TREE_DETAIL_COLUMNS = [
  "id",
  "id_arvore_siia",
  "bairro_id",
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
  "cep",
  "observacoes",
  "class_especial",
  "novo_plantio",
  "responsavel",
  "foto_url",
  "created_by",
].join(",");

function treeRowToProperties(row) {
  return {
    ID: row.id,
    ID_ARVORE_SIIA: row.id_arvore_siia ?? null,
    BAIRRO_ID: row.bairro_id ?? null,
    UTM_X_SIRGAS_2000: row.utm_x_sirgas_2000 ?? null,
    UTM_Y_SIRGAS_2000: row.utm_y_sirgas_2000 ?? null,
    TIPO_INDIVIDUO: row.tipo_individuo ?? null,
    LOCAL_PLANTIO: row.local_plantio ?? null,
    LOGRADOURO_REFERENCIA: row.logradouro_referencia ?? null,
    NUMERO_REFERENCIA: row.numero_referencia ?? null,
    LOCAL_REFERENCIA: row.local_referencia ?? null,
    NOME_CIENTIFICO: row.nome_cientifico ?? null,
    NOME_POPULAR: row.nome_popular ?? null,
    DATA_LEVANTAMENTO: row.data_levantamento ?? null,
    ORGAO_LEVANTAMENTO: row.orgao_levantamento ?? null,
    CEP: row.cep ?? null,
    OBSERVACOES: row.observacoes ?? null,
    CLASS_ESPECIAL: row.class_especial ?? null,
    NOVO_PLANTIO: row.novo_plantio ?? null,
    RESPONSAVEL: row.responsavel ?? null,
    FOTO_URL: row.foto_url ?? null,
    CREATED_BY: row.created_by ?? null,
  };
}

export async function fetchTreeById(treeId, signal) {
  if (treeId == null || treeId === "") return null;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("trees")
      .select(TREE_DETAIL_COLUMNS)
      .eq("id", Number(treeId))
      .maybeSingle()
      .abortSignal(signal);

    if (!error) {
      return data ? treeRowToProperties(data) : null;
    }
    console.warn("Supabase tree detail failed, trying local API:", error.message);
  }

  const response = await fetch(`/api/trees/${encodeURIComponent(treeId)}`, {
    signal,
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Tree API responded with ${response.status}`);
  }
  return response.json();
}

export async function uploadTreePhoto(photoFile, userId) {
  if (!photoFile) return null;
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId || "anon"}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from("tree-photos")
    .upload(path, photoFile, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Erro ao enviar foto: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from("tree-photos").getPublicUrl(path);
  return data?.publicUrl || null;
}

export async function insertUserTree({ formData, coords, photoFile, user }) {
  let fotoUrl = null;
  if (photoFile && user && isSupabaseConfigured) {
    try {
      fotoUrl = await uploadTreePhoto(photoFile, user.id);
    } catch (err) {
      console.warn("Photo upload fallback:", err);
    }
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("insert_user_tree", {
      lng: coords[0],
      lat: coords[1],
      p_nome_popular: formData.NOME_POPULAR || null,
      p_nome_cientifico: formData.NOME_CIENTIFICO || null,
      p_local_plantio: formData.LOCAL_PLANTIO || null,
      p_logradouro_referencia: formData.LOGRADOURO_REFERENCIA || null,
      p_numero_referencia: formData.NUMERO_REFERENCIA || null,
      p_cep: formData.CEP || null,
      p_observacoes: formData.OBSERVACOES || null,
      p_class_especial: formData.CLASS_ESPECIAL || null,
      p_novo_plantio: formData.NOVO_PLANTIO || null,
      p_responsavel: formData.RESPONSAVEL || null,
      p_foto_url: fotoUrl,
    });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  return null;
}

const PLANTING_STORAGE_KEY = "gdu_rmbh_planting_suggestions";

function readLocalPlantingSuggestions() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PLANTING_STORAGE_KEY) || "[]"
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function plantingCollection(features) {
  return { type: "FeatureCollection", features };
}

export async function fetchPlantingSuggestions(bounds, signal) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .rpc("planting_suggestions_in_bbox", {
        min_lng: bounds.getWest(),
        min_lat: bounds.getSouth(),
        max_lng: bounds.getEast(),
        max_lat: bounds.getNorth(),
      })
      .abortSignal(signal);

    if (error) {
      throw new Error(error.message);
    }
    return data ?? plantingCollection([]);
  }

  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  const features = readLocalPlantingSuggestions().filter((feature) => {
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    return lng >= west && lng <= east && lat >= south && lat <= north;
  });
  return plantingCollection(features);
}

export async function insertPlantingSuggestion({
  coords,
  notes,
  logradouro,
  numero,
  cep,
  localPlantio,
  photoFile,
  user,
}) {
  let fotoUrl = null;
  if (photoFile && user && isSupabaseConfigured) {
    fotoUrl = await uploadTreePhoto(photoFile, user.id);
  }

  const address = [logradouro, numero].filter(Boolean).join(", ") || null;

  if (isSupabaseConfigured && supabase) {
    if (!user) {
      throw new Error("Autenticação necessária para indicar um local de plantio.");
    }
    const { data, error } = await supabase.rpc("insert_planting_suggestion", {
      lng: coords[0],
      lat: coords[1],
      p_notes: notes || null,
      p_logradouro: logradouro || null,
      p_numero: numero || null,
      p_cep: cep || null,
      p_local_plantio: localPlantio || null,
      p_foto_url: fotoUrl,
    });
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  const feature = {
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: {
      ID: Date.now(),
      ADDRESS: address,
      LOGRADOURO: logradouro || null,
      NUMERO: numero || null,
      CEP: cep || null,
      LOCAL_PLANTIO: localPlantio || null,
      NOTES: notes || null,
      FOTO_URL: photoFile ? URL.createObjectURL(photoFile) : null,
      STATUS: "open",
      CREATED_AT: new Date().toISOString(),
    },
  };
  const saved = readLocalPlantingSuggestions();
  saved.push(feature);
  window.localStorage.setItem(PLANTING_STORAGE_KEY, JSON.stringify(saved));
  return feature;
}

const PROBLEM_STORAGE_KEY = "gdu_rmbh_problem_reports";

function readLocalProblemReports() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PROBLEM_STORAGE_KEY) || "[]"
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function fetchProblemReports(bounds, signal) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .rpc("problem_reports_in_bbox", {
        min_lng: bounds.getWest(),
        min_lat: bounds.getSouth(),
        max_lng: bounds.getEast(),
        max_lat: bounds.getNorth(),
      })
      .abortSignal(signal);

    if (error) {
      throw new Error(error.message);
    }
    return data ?? plantingCollection([]);
  }

  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  const features = readLocalProblemReports().filter((feature) => {
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    return lng >= west && lng <= east && lat >= south && lat <= north;
  });
  return plantingCollection(features);
}

export async function insertProblemReport({
  coords,
  reportType,
  notes,
  logradouro,
  numero,
  cep,
  localPlantio,
  photoFile,
  treeId,
  user,
}) {
  let fotoUrl = null;
  if (photoFile && user && isSupabaseConfigured) {
    fotoUrl = await uploadTreePhoto(photoFile, user.id);
  }

  const address = [logradouro, numero].filter(Boolean).join(", ") || null;

  if (isSupabaseConfigured && supabase) {
    if (!user) {
      throw new Error("Autenticação necessária para relatar um problema.");
    }
    const { data, error } = await supabase.rpc("insert_problem_report", {
      lng: coords[0],
      lat: coords[1],
      p_report_type: reportType,
      p_notes: notes || null,
      p_logradouro: logradouro || null,
      p_numero: numero || null,
      p_cep: cep || null,
      p_local_plantio: localPlantio || null,
      p_foto_url: fotoUrl,
      p_tree_id: treeId ? Number(treeId) : null,
    });
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  const feature = {
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: {
      ID: Date.now(),
      TREE_ID: treeId || null,
      REPORT_TYPE: reportType,
      ADDRESS: address,
      LOGRADOURO: logradouro || null,
      NUMERO: numero || null,
      CEP: cep || null,
      LOCAL_PLANTIO: localPlantio || null,
      NOTES: notes || null,
      FOTO_URL: photoFile ? URL.createObjectURL(photoFile) : null,
      STATUS: "open",
      CREATED_AT: new Date().toISOString(),
    },
  };
  const saved = readLocalProblemReports();
  saved.push(feature);
  window.localStorage.setItem(PROBLEM_STORAGE_KEY, JSON.stringify(saved));
  return feature;
}

export async function submitTreeReport({ treeId, reportType, notes, user, createdBy }) {
  if (isSupabaseConfigured && supabase && user) {
    const { error } = await supabase.from("tree_reports").insert({
      tree_id: Number(treeId),
      report_type: reportType,
      notes: notes || null,
      created_by: user.id,
    });
    if (error) {
      throw new Error(error.message);
    }

    // If the user is reporting their own collaborative tree as missing, remove it from DB too
    if (reportType === "missing" && createdBy && String(createdBy) === String(user.id)) {
      await supabase.from("trees").delete().eq("id", Number(treeId));
    }

    return { persisted: true };
  }

  const localReports = JSON.parse(
    window.localStorage.getItem("gdu_rmbh_tree_reports") || "[]"
  );
  localReports.push({
    id: Date.now(),
    tree_id: Number(treeId),
    report_type: reportType,
    notes: notes || null,
    created_by: user?.id || null,
    created_at: new Date().toISOString(),
  });
  window.localStorage.setItem(
    "gdu_rmbh_tree_reports",
    JSON.stringify(localReports)
  );
  return { persisted: false };
}

export async function fetchAnalyticsSummary(signal) {
  const response = await fetch("/data/analytics_summary.json", {
    signal,
  });
  if (response.ok) {
    return response.json();
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .rpc("dashboard_overview")
      .abortSignal(signal);
    if (!error && data) {
      return {
        kpis: data,
        topSpecies: data.topSpecies || [],
        bairros: [],
      };
    }
  }

  throw new Error("Não foi possível carregar o resumo analítico.");
}
