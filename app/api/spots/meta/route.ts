import { NextResponse } from 'next/server'
import { COUNTRIES, regionsForCountry } from '@/lib/spots/static-store'

export const revalidate = 86400

// Returns distinct countries and (optionally) regions for a given country
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const country = (searchParams.get('country') ?? '').slice(0, 100) || null

  if (country) {
    // Return distinct region values for this country
    return NextResponse.json(
      { regions: regionsForCountry(country) },
      { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=86400' } }
    )
  }

  // Return distinct countries
  return NextResponse.json(
    { countries: [...COUNTRIES] },
    { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=86400' } }
  )
}
