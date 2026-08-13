import { NextResponse } from 'next/server'
import { getSpotBySlug } from '@/lib/spots/static-store'
import { fetchCoastalAlerts } from '@/lib/api/nws-alerts'

export const revalidate = 900 // 15 min

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const spot = getSpotBySlug(slug)
  if (!spot) return NextResponse.json({ error: 'Spot not found' }, { status: 404 })

  const alerts = await fetchCoastalAlerts(spot.lat, spot.lng)
  return NextResponse.json({ alerts }, {
    headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=180' },
  })
}
