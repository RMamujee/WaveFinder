import type { WindyWebcam } from './windy-webcams'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dlat = (lat2 - lat1) * (Math.PI / 180)
  const dlng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dlng / 2) ** 2
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i

export async function fetchOSMWebcams(lat: number, lng: number): Promise<WindyWebcam[]> {
  try {
    const query = `[out:json][timeout:10];node["tourism"="webcam"](around:10000,${lat},${lng});out body;`

    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const data = await res.json()
    const elements: Record<string, unknown>[] = data?.elements ?? []

    const results: WindyWebcam[] = []

    for (const el of elements) {
      const tags = (el.tags ?? {}) as Record<string, string>
      const rawUrl = tags.url ?? tags.image ?? ''
      const website = tags.website ?? tags['contact:website'] ?? ''
      if (!rawUrl && !website) continue

      const wLat = el.lat as number
      const wLng = el.lon as number
      const isImg = IMAGE_EXT.test(rawUrl)

      results.push({
        webcamId: `osm-${String(el.id ?? '')}`,
        title: tags.name ?? tags['name:en'] ?? 'Beach Webcam',
        thumbnail: isImg ? rawUrl : '',
        previewUrl: isImg ? rawUrl : '',
        playerEmbedUrl: website || rawUrl,
        lat: wLat,
        lng: wLng,
        city: tags['addr:city'] ?? tags.operator ?? '',
        distanceKm: haversineKm(lat, lng, wLat, wLng),
        source: 'osm' as const,
      })
    }

    return results.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 6)
  } catch {
    return []
  }
}
