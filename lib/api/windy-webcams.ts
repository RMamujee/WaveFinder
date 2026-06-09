const WINDY_BASE = 'https://api.windy.com/webcams/api/v3/webcams'

export interface WindyWebcam {
  webcamId: string
  title: string
  thumbnail: string
  previewUrl: string
  playerEmbedUrl: string
  lat: number
  lng: number
  city: string
  distanceKm: number
  source: 'windy' | 'osm' | 'youtube'
}

export async function fetchNearbyWebcams(
  lat: number,
  lng: number,
  radiusKm = 10
): Promise<WindyWebcam[]> {
  const apiKey = process.env.WINDY_WEBCAM_API_KEY
  if (!apiKey) return []

  try {
    // v3 API: field name is "images" (not "image"); player.day/live are direct URL strings
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius: radiusKm.toString(),
      limit: '6',
      categories: 'beach,coast',
      show: 'webcam:images,player,location',
    })

    const res = await fetch(`${WINDY_BASE}?${params}`, {
      headers: { 'x-windy-api-key': apiKey },
      next: { revalidate: 21600 },
    })

    if (!res.ok) return []

    const data = await res.json()

    return ((data.webcams ?? []) as Record<string, unknown>[])
      .filter((w) => w.status === 'active')
      .map((w) => {
        const loc = (w.location ?? {}) as Record<string, unknown>
        // v3: top-level key is "images", not "image"
        const imgs = ((w.images ?? {}) as Record<string, unknown>)
        const currentImg = ((imgs.current ?? {}) as Record<string, unknown>)
        // v3: player.day and player.live are direct URL strings, not {embed, iframe} objects
        const player = ((w.player ?? {}) as Record<string, unknown>)
        const embedUrl = String(player.live ?? player.day ?? '')

        const wLat = Number(loc.latitude ?? 0)
        const wLng = Number(loc.longitude ?? 0)
        const dlat = (wLat - lat) * (Math.PI / 180)
        const dlng = (wLng - lng) * (Math.PI / 180)
        const a =
          Math.sin(dlat / 2) ** 2 +
          Math.cos(lat * (Math.PI / 180)) * Math.cos(wLat * (Math.PI / 180)) * Math.sin(dlng / 2) ** 2
        const distanceKm = Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10

        return {
          webcamId: String(w.webcamId ?? ''),
          title: String(w.title ?? 'Webcam'),
          thumbnail: String(currentImg.preview ?? currentImg.icon ?? ''),
          previewUrl: String(currentImg.preview ?? currentImg.icon ?? ''),
          playerEmbedUrl: embedUrl,
          lat: wLat,
          lng: wLng,
          city: String(loc.city ?? loc.region ?? ''),
          distanceKm,
          source: 'windy' as const,
        }
      })
      .filter((w) => w.playerEmbedUrl || w.thumbnail)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  } catch {
    return []
  }
}
