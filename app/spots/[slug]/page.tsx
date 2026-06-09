import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { cache } from 'react'
import { SpotForecastView } from './SpotForecastView'
import { SpotCard } from '@/components/spots/SpotCard'
import { WaveLoader } from '@/components/layout/WaveLoader'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { SurfSpot } from '@/types/spot'
import { inferBottomType } from '@/lib/bottom-type'

type PrismaSpot = Awaited<ReturnType<typeof prisma.surfSpot.findUniqueOrThrow>>

function toSurfSpot(s: PrismaSpot): SurfSpot {
  const VALID = new Set(['beginner', 'intermediate', 'advanced'])
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    region: s.region,
    country: s.country,
    lat: s.lat,
    lng: s.lng,
    description: s.description,
    difficulty: VALID.has(s.difficulty) ? (s.difficulty as SurfSpot['difficulty']) : 'intermediate',
    facingDirection: s.facingDirection,
    noaaTideStationId: s.noaaTideStationId,
    noaaBuoyId: s.noaaBuoyId,
    webcamUrl: s.webcamUrl,
    webcamType: s.webcamType,
    parkingOptions: s.parkingOptions as SurfSpot['parkingOptions'] ?? null,
    bottomType: inferBottomType(s.description, s.name),
  }
}

interface Props {
  params: Promise<{ slug: string }>
}

// Spot metadata (name, region, coordinates, description) only changes when the
// seed data changes, so render each spot page once a day via ISR instead of
// hitting the database on every request. Forecast data stays live — it loads
// client-side from /api/forecast.
export const revalidate = 86400

// No paths prerendered at build (the build has no DB access); each spot page
// is generated on first visit, then served from the cache for `revalidate`.
export function generateStaticParams() {
  return []
}

const getSpot = cache(async (slug: string) =>
  prisma.surfSpot.findUnique({ where: { slug } })
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const spot = await getSpot(slug)
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
  const spot = await getSpot(slug)

  if (!spot) notFound()

  // Fetch nearby spots in the same broad region (exclude this spot)
  const regionKeyword = broadRegion(spot.region)
  const nearbySpots = regionKeyword
    ? await prisma.surfSpot.findMany({
        where: {
          region: { contains: regionKeyword },
          slug: { not: slug },
        },
        orderBy: { name: 'asc' },
        take: 8,
      })
    : []

  return (
    <>
      <Suspense fallback={<WaveLoader label="Loading forecast…" />}>
        <SpotForecastView spot={toSurfSpot(spot)} />
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
                <SpotCard key={s.slug} spot={toSurfSpot(s)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
