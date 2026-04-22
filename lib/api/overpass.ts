const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter'

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

export async function fetchNearbyAmenities(lat: number, lng: number): Promise<Amenity[]> {
  const radius = 1000
  const query = `
[out:json][timeout:20];
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
    const res = await fetch(OVERPASS_BASE, {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) return []
    const json = await res.json()

    const results: Amenity[] = (json.elements ?? [])
      .map((el: any) => {
        const elLat: number = el.lat ?? el.center?.lat
        const elLng: number = el.lon ?? el.center?.lon
        if (!elLat || !elLng) return null
        const amenityType: string =
          el.tags?.amenity ?? el.tags?.leisure ?? el.tags?.emergency ?? 'unknown'
        const meta = TYPE_META[amenityType] ?? { label: amenityType, emoji: '📍' }
        return {
          id: el.id,
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
