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
    const features: unknown[] = json?.features ?? []
    return features.map((feature: unknown) => {
      const f = feature as {
        id?: string
        properties?: { mag?: number; place?: string; time?: number; url?: string; tsunami?: number }
        geometry?: { coordinates?: number[] }
      }
      const p = f.properties ?? {}
      return {
        id: f.id ?? '',
        magnitude: p.mag ?? 0,
        place: p.place ?? 'Unknown location',
        time: new Date(p.time ?? 0).toISOString(),
        depth: Math.round(f.geometry?.coordinates?.[2] ?? 0),
        url: p.url ?? '',
        tsunami: p.tsunami ?? 0,
      } satisfies EarthquakeEvent
    })
  } catch {
    return []
  }
}
