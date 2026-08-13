import { getSpotBySlug, spotsInRegion, SLUGS } from '@/lib/spots/static-store'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { SpotForecastView } from './SpotForecastView'
import { SpotCard } from '@/components/spots/SpotCard'
import { WaveLoader } from '@/components/layout/WaveLoader'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

// Spot metadata (name, region, coordinates, description) only changes when the
// seed data changes, so prerender every spot page at build and revalidate daily
// instead of hitting the database on every request. Forecast data stays live —
// it loads client-side from /api/forecast.
export const revalidate = 86400

// All slugs are prerendered from the static dataset, and dynamicParams=false
// makes unknown slugs return a real 404 without rendering. (On-demand ISR
// rendering of unknown slugs produced soft-404s: notFound() after the streamed
// shell got cached as a 200 — see docs/audit/05-post-deploy-audit-2026-06-09.md.)
export const dynamicParams = false

export function generateStaticParams() {
  // Spots are served from the in-memory static store, so prerendering no longer
  // depends on DATABASE_URL — every slug renders at build in all environments.
  return SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const spot = getSpotBySlug(slug)
  // Throw notFound here, not just in the page body: metadata resolves before
  // the response starts streaming, so this is what guarantees unknown slugs
  // get a real 404 status instead of an ISR-cached 200 with not-found UI.
  if (!spot) notFound()
  return {
    title: `${spot.name} Surf Forecast – WaveFinder`,
    description: `7-day surf forecast for ${spot.name}, ${spot.region}. Wave height, swell period, wind, and tides.`,
  }
}

// Extract the broad region keyword from a "City, Region" string
function broadRegion(region: string): string {
  const parts = region.split(',')
  return parts[parts.length - 1].trim()
}

export default async function SpotPage({ params }: Props) {
  const { slug } = await params
  const spot = getSpotBySlug(slug)

  if (!spot) notFound()

  // Fetch nearby spots in the same broad region (exclude this spot)
  const regionKeyword = broadRegion(spot.region)
  const nearbySpots = regionKeyword
    ? spotsInRegion(regionKeyword)
        .filter((s) => s.slug !== slug)
        .slice(0, 8)
    : []

  return (
    <>
      <Suspense fallback={<WaveLoader label="Loading forecast…" />}>
        <SpotForecastView spot={spot} />
      </Suspense>

      {/* More spots in this region */}
      {nearbySpots.length > 0 && (
        <div style={{ background: 'var(--sand-50)', borderTop: '1px solid var(--border)' }}>
          <div className="mx-auto max-w-7xl px-5 py-8">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="font-semibold text-sm uppercase tracking-widest"
                style={{ color: 'var(--text-2)', fontFamily: 'var(--font-dm-sans), sans-serif' }}
              >
                More in {regionKeyword}
              </h2>
              <Link
                href={`/spots?region=${encodeURIComponent(regionKeyword)}`}
                className="text-xs font-semibold"
                style={{ color: 'var(--ocean-600)' }}
              >
                View all →
              </Link>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8">
              {nearbySpots.map((s) => (
                <SpotCard key={s.slug} spot={s} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
