const BASE = 'https://nominatim.openstreetmap.org'

// Nominatim requires a descriptive User-Agent identifying the application
const HEADERS = {
  'User-Agent': 'WaveFinder/1.0 (surf-forecast-app; contact: heyrahil@gmail.com)',
  'Accept-Language': 'en',
  'Accept': 'application/json',
}

export interface GeocodedPlace {
  displayName: string
  shortName: string
  lat: number
  lng: number
  type: string
  importance: number
}

export async function geocodeQuery(query: string): Promise<GeocodedPlace[]> {
  if (!query.trim()) return []
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      addressdetails: '1',
    })
    const res = await fetch(`${BASE}/search?${params}`, {
      headers: HEADERS,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json: any[] = await res.json()
    return json.map((r) => {
      const addr = r.address ?? {}
      const shortName =
        addr.city ?? addr.town ?? addr.village ?? addr.county ?? addr.state ?? r.display_name
      return {
        displayName: r.display_name,
        shortName,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        type: r.type ?? r.class ?? 'place',
        importance: r.importance ?? 0,
      }
    })
  } catch {
    return []
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      zoom: '10',
    })
    const res = await fetch(`${BASE}/reverse?${params}`, {
      headers: HEADERS,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const a = json.address ?? {}
    return a.city ?? a.town ?? a.village ?? a.county ?? a.state ?? json.display_name ?? null
  } catch {
    return null
  }
}
