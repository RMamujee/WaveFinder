const BASE = 'https://earthquake.usgs.gov/fdsnws/event/1/query'

export interface EarthquakeEvent {
  id: string
  magnitude: number
  place: string
  time: string   // ISO
  depth: number  // km
  url: string
  tsunami: number  // 1 if tsunami was generated
}

export async function fetchNearbyEarthquakes(lat: number, lng: number): Promise<EarthquakeEvent[]> {
  try {
    const startTime = new Date(Date.now() - 30 * 86400 * 1000).toISOString()
    const params = new URLSearchParams({
      format: 'geojson',
      latitude: lat.toString(),
      longitude: lng.toString(),
      maxradiuskm: '800',
      minmagnitude: '4.5',
      starttime: startTime,
      limit: '5',
      orderby: 'magnitude',
    })
    const res = await fetch(`${BASE}?${params}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.features ?? []).map((f: any) => ({
      id: f.id,
      magnitude: f.properties.mag,
      place: f.properties.place ?? 'Unknown location',
      time: new Date(f.properties.time).toISOString(),
      depth: Math.round(f.geometry?.coordinates?.[2] ?? 0),
      url: f.properties.url ?? '',
      tsunami: f.properties.tsunami ?? 0,
    }))
  } catch {
    return []
  }
}
