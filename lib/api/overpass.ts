// Overpass mirrors, tried in order. The main instance answers HTTP 504
// ("Dispatcher_Client::request_read_and_idx::timeout. The server is probably
// too busy") often enough that a single attempt is not a reliable read: a
// probe of Malibu's own coordinates returned 504 first and 49 elements on
// retry. `!res.ok` turns that into `[]`, which the route then caches as a
// definitive "this beach has no facilities" for a day — the same trap the
// Open-Meteo layer avoids by never caching a transient failure.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export interface Amenity {
  id: number
  lat: number
  lng: number
  name: string | null
  amenityType: string
  label: string
  emoji: string
  distanceM: number
}

const TYPE_META: Record<string, { label: string; emoji: string }> = {
  toilets:        { label: 'Restrooms',       emoji: '🚻' },
  parking:        { label: 'Parking',         emoji: '🅿️' },
  cafe:           { label: 'Cafe',            emoji: '☕' },
  restaurant:     { label: 'Restaurant',      emoji: '🍽️' },
  shower:         { label: 'Outdoor Shower',  emoji: '🚿' },
  drinking_water: { label: 'Drinking Water',  emoji: '💧' },
  bicycle_rental: { label: 'Bike Rental',     emoji: '🚲' },
  surf_school:    { label: 'Surf School',     emoji: '🏄' },
  first_aid:      { label: 'First Aid',       emoji: '🏥' },
  lifeguard:      { label: 'Lifeguard',       emoji: '🛟' },
  ice_cream:      { label: 'Ice Cream',       emoji: '🍦' },
  fast_food:      { label: 'Fast Food',       emoji: '🍔' },
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function runOverpass(query: string): Promise<{ elements?: unknown[] } | null> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(9000),
      })
      if (!res.ok) continue
      // A busy instance can also answer 200 with an HTML error document.
      return await res.json()
    } catch {
      // Timed out or the mirror is down — fall through to the next one.
    }
  }
  return null
}

export async function fetchNearbyAmenities(lat: number, lng: number): Promise<Amenity[]> {
  const radius = 1000
  const query = `
[out:json][timeout:12];
(
  node["amenity"~"^(toilets|parking|cafe|restaurant|shower|drinking_water|ice_cream|fast_food)$"](around:${radius},${lat},${lng});
  node["leisure"="surf_school"](around:${radius},${lat},${lng});
  node["emergency"="first_aid"](around:${radius},${lat},${lng});
  node["amenity"="lifeguard"](around:${radius},${lat},${lng});
  way["amenity"="parking"](around:${radius},${lat},${lng});
);
out center;
`.trim()

  try {
    const json = await runOverpass(query)
    if (!json) return []

    const elements: unknown[] = json?.elements ?? []
    const results: Amenity[] = elements
      .map((element: unknown) => {
        const el = element as {
          id?: number
          lat?: number
          lon?: number
          center?: { lat?: number; lon?: number }
          tags?: Record<string, string | undefined>
        }
        const elLat = el.lat ?? el.center?.lat
        const elLng = el.lon ?? el.center?.lon
        if (!elLat || !elLng) return null
        const amenityType: string =
          el.tags?.amenity ?? el.tags?.leisure ?? el.tags?.emergency ?? 'unknown'
        const meta = TYPE_META[amenityType] ?? { label: amenityType, emoji: '📍' }
        return {
          id: el.id ?? 0,
          lat: elLat,
          lng: elLng,
          name: el.tags?.name ?? null,
          amenityType,
          label: meta.label,
          emoji: meta.emoji,
          distanceM: Math.round(haversineM(lat, lng, elLat, elLng)),
        } satisfies Amenity
      })
      .filter((a: Amenity | null): a is Amenity => a !== null)
      .sort((a: Amenity, b: Amenity) => a.distanceM - b.distanceM)
      .slice(0, 15)

    // Deduplicate by (type, name) — Overpass can return both node + way for same parking lot
    const seen = new Set<string>()
    return results.filter((a) => {
      const key = `${a.amenityType}::${a.name ?? a.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch {
    return []
  }
}
