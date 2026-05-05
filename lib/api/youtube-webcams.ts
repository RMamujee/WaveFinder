import type { WindyWebcam } from './windy-webcams'

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

export async function fetchYouTubeSurfCams(
  spotName: string,
  region: string
): Promise<WindyWebcam[]> {
  void region
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return []

  try {
    // Search for live streams first, then fall back to recent relevant uploads
    const params = new URLSearchParams({
      part: 'snippet',
      q: `${spotName} surf cam`,
      type: 'video',
      eventType: 'live',
      maxResults: '4',
      relevanceLanguage: 'en',
      key: apiKey,
    })

    const res = await fetch(`${YT_BASE}/search?${params}`, {
      // 24-hour cache — YouTube search costs 100 quota units each,
      // so we cache aggressively to stay within the 10,000/day free limit.
      next: { revalidate: 86400 },
    })

    if (!res.ok) return []

    const data = await res.json()
    const items: Record<string, unknown>[] = data?.items ?? []

    return items
      .filter((item) => {
        const id = (item.id as Record<string, string> | null)
        return id?.videoId && (item.snippet as Record<string, string>)?.liveBroadcastContent === 'live'
      })
      .map((item) => {
        const videoId = (item.id as Record<string, string>).videoId
        const snippet = (item.snippet ?? {}) as Record<string, unknown>
        const thumbs = (snippet.thumbnails ?? {}) as Record<string, { url: string }>
        const thumb = thumbs.medium?.url ?? thumbs.default?.url ?? ''

        return {
          webcamId: `yt-${videoId}`,
          title: String(snippet.title ?? 'Live Surf Cam'),
          thumbnail: thumb,
          previewUrl: thumb,
          playerEmbedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1`,
          lat: 0,
          lng: 0,
          city: '',
          distanceKm: 0,
          source: 'youtube' as const,
        } satisfies WindyWebcam
      })
  } catch {
    return []
  }
}
