export function nextTreeId(features) {
  const maxId = features.reduce((max, feature) => {
    const id = Number(feature.properties?.ID) || 0;
    return id > max ? id : max;
  }, 0);
  return maxId + 1;
}

export function treeFeatureFromForm({ formData, coords, nextId }) {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: coords,
    },
    properties: {
      ID: nextId,
      ID_ARVORE_SIIA: null,
      TIPO_INDIVIDUO: "Árvore",
      LOCAL_PLANTIO: formData.LOCAL_PLANTIO ?? null,
      LOGRADOURO_REFERENCIA: formData.LOGRADOURO_REFERENCIA ?? null,
      NUMERO_REFERENCIA: formData.NUMERO_REFERENCIA ?? null,
      LOCAL_REFERENCIA: null,
      NOME_POPULAR: formData.NOME_POPULAR ?? null,
      NOME_CIENTIFICO: null,
      DATA_LEVANTAMENTO: new Date().toISOString(),
      ORGAO_LEVANTAMENTO: "Colaborativo",
      CEP: formData.CEP ?? null,
      OBSERVACOES: formData.OBSERVACOES ?? null,
      CLASS_ESPECIAL: formData.CLASS_ESPECIAL ?? null,
      NOVO_PLANTIO: formData.NOVO_PLANTIO ?? null,
      RESPONSAVEL: formData.RESPONSAVEL ?? null,
      UTM_X_SIRGAS_2000: null,
      UTM_Y_SIRGAS_2000: null,
    },
  };
}
