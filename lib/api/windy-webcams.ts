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
}

export async function fetchNearbyWebcams(
  lat: number,
  lng: number,
  radiusKm = 20
): Promise<WindyWebcam[]> {
  const apiKey = process.env.WINDY_WEBCAM_API_KEY
  if (!apiKey) return []

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius: radiusKm.toString(),
      limit: '8',
      show: 'webcam:image,player,location',
    })

    const res = await fetch(`${WINDY_BASE}?${params}`, {
      headers: { 'x-windy-api-key': apiKey },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const data = await res.json()

    return ((data.webcams ?? []) as Record<string, unknown>[])
      .filter((w) => w.status === 'active')
      .map((w) => {
        const loc = (w.location ?? {}) as Record<string, unknown>
        const img = ((w.image ?? {}) as Record<string, unknown>)
        const currentImg = ((img.current ?? {}) as Record<string, unknown>)
        const player = ((w.player ?? {}) as Record<string, unknown>)
        const dayPlayer = ((player.day ?? {}) as Record<string, unknown>)
        const lifetimePlayer = ((player.lifetime ?? {}) as Record<string, unknown>)

        const wLat = Number(loc.latitude ?? 0)
        const wLng = Number(loc.longitude ?? 0)
        // Haversine approximation (good enough at <50 km)
        const dlat = (wLat - lat) * (Math.PI / 180)
        const dlng = (wLng - lng) * (Math.PI / 180)
        const a =
          Math.sin(dlat / 2) ** 2 +
          Math.cos(lat * (Math.PI / 180)) * Math.cos(wLat * (Math.PI / 180)) * Math.sin(dlng / 2) ** 2
        const distanceKm = Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10

        return {
          webcamId: String(w.webcamId ?? ''),
          title: String(w.title ?? 'Webcam'),
          thumbnail: String(currentImg.thumbnail ?? currentImg.icon ?? ''),
          previewUrl: String(currentImg.preview ?? currentImg.thumbnail ?? ''),
          playerEmbedUrl: String(dayPlayer.embed ?? lifetimePlayer.embed ?? ''),
          lat: wLat,
          lng: wLng,
          city: String(loc.city ?? loc.region ?? ''),
          distanceKm,
        }
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
  } catch {
    return []
  }
}
