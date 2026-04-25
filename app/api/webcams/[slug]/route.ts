import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchNearbyWebcams } from '@/lib/api/windy-webcams'

export const revalidate = 3600
export const maxDuration = 15

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
    select: { lat: true, lng: true },
  })

  if (!spot) return NextResponse.json([], { status: 404 })

  const webcams = await fetchNearbyWebcams(spot.lat, spot.lng)
  console.log(`[webcams/${slug}] found ${webcams.length} cams, key set: ${!!process.env.WINDY_WEBCAM_API_KEY}`)

  return NextResponse.json(webcams, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' },
  })
}
