import { NextResponse } from 'next/server'
import { geocodeQuery } from '@/lib/api/nominatim'

export const revalidate = 3600

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }
  // Basic sanitisation — strip characters Nominatim doesn't expect
  if (q.length > 100 || /[<>{}]/.test(q)) {
    return NextResponse.json({ results: [] })
  }
  const results = await geocodeQuery(q)
  return NextResponse.json({ results }, {
    headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' },
  })
}
