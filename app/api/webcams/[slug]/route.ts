import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchNearbyWebcams } from '@/lib/api/windy-webcams'
import { fetchOSMWebcams } from '@/lib/api/osm-webcams'
import { fetchYouTubeSurfCams } from '@/lib/api/youtube-webcams'

export const revalidate = 3600
export const maxDuration = 20

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json([], { status: 400 })
  }

  const spot = await prisma.surfSpot.findUnique({
    where: { slug },
    select: { lat: true, lng: true, name: true, region: true },
  })

  if (!spot) return NextResponse.json([], { status: 404 })

  // Fetch from all three sources in parallel; any individual failure returns []
  const [windyResult, osmResult, youtubeResult] = await Promise.allSettled([
    fetchNearbyWebcams(spot.lat, spot.lng),
    fetchOSMWebcams(spot.lat, spot.lng),
    fetchYouTubeSurfCams(spot.name, spot.region),
  ])

  const windy   = windyResult.status   === 'fulfilled' ? windyResult.value   : []
  const osm     = osmResult.status     === 'fulfilled' ? osmResult.value     : []
  const youtube = youtubeResult.status === 'fulfilled' ? youtubeResult.value : []

  // Merge: Windy + OSM sorted by distance, YouTube live cams appended at end
  const merged = [...windy, ...osm].sort((a, b) => a.distanceKm - b.distanceKm)
  const all = [...merged, ...youtube]

  console.log(
    `[webcams/${slug}] windy=${windy.length} osm=${osm.length} youtube=${youtube.length} total=${all.length}`
  )

  return NextResponse.json(all, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' },
  })
}
