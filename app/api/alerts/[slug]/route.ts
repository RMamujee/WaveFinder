import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchSurfAlerts } from '@/lib/api/noaa-alerts'

export const revalidate = 1800
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

  const alerts = await fetchSurfAlerts(spot.lat, spot.lng)

  return NextResponse.json(alerts, {
    headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=900' },
  })
}
