export async function fetchTreesInView(bounds, signal) {
  const params = new URLSearchParams({
    min_lng: bounds.getWest(),
    min_lat: bounds.getSouth(),
    max_lng: bounds.getEast(),
    max_lat: bounds.getNorth(),
  });

  const response = await fetch(`/api/trees?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Tree API responded with ${response.status}`);
  }
  return response.json();
}
