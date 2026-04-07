import Link from 'next/link'
import { prisma } from '@/lib/prisma'

// Major regions in geographic order (S → N)
const REGIONS = [
  {
    name: 'San Diego',
    keyword: 'San Diego',
    slug: 'San+Diego',
    desc: 'World-class reef breaks, beach breaks, and points from the border up to La Jolla Cove.',
    color: '#1b7fcb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: '🌊',
  },
  {
    name: 'Orange County',
    keyword: 'Orange County',
    slug: 'Orange+County',
    desc: 'Trestles, Huntington Beach Pier, and the Newport boardwalk — the heart of SoCal surfing.',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    icon: '🏄',
  },
  {
    name: 'Los Angeles',
    keyword: 'Los Angeles',
    slug: 'Los+Angeles',
    desc: "Malibu's long rights, El Porto, Venice, and Palos Verdes — surf culture capital of the world.",
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    icon: '🌅',
  },
  {
    name: 'Ventura County',
    keyword: 'Ventura',
    slug: 'Ventura',
    desc: 'C Street, Rincon, and the county line — home to some of the most consistent surf in California.',
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
    icon: '🤙',
  },
  {
    name: 'Santa Barbara',
    keyword: 'Santa Barbara',
    slug: 'Santa+Barbara',
    desc: 'Rincon to Refugio — beautiful, often uncrowded breaks backed by the Santa Ynez Mountains.',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    icon: '⛵',
  },
  {
    name: 'Central Coast',
    keyword: 'Central Coast',
    slug: 'Central+Coast',
    desc: 'Morro Bay, Pismo, and Cayucos — mellow beach breaks and exposed reefs far from the crowds.',
    color: '#b45309',
    bg: '#fef3c7',
    border: '#fde68a',
    icon: '🦭',
  },
  {
    name: 'Monterey Bay',
    keyword: 'Monterey',
    slug: 'Monterey',
    desc: 'Steamer Lane, Pleasure Point, and Moss Landing — where NorCal surfing really begins.',
    color: '#15803d',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    icon: '🌊',
  },
  {
    name: 'NorCal',
    keyword: 'NorCal',
    slug: 'NorCal',
    desc: 'Ocean Beach, Mavericks, the Sonoma coast, and beyond — powerful, cold, and untamed.',
    color: '#374151',
    bg: '#f9fafb',
    border: '#e5e7eb',
    icon: '🐻',
  },
]

export default async function RegionsPage() {
  // Fetch spot counts + difficulty breakdown for each region
  const regionData = await Promise.all(
    REGIONS.map(async (r) => {
      const spots = await prisma.surfSpot.findMany({
        where: { region: { contains: r.keyword } },
        select: { difficulty: true, slug: true },
      })
      const beginner     = spots.filter((s) => s.difficulty === 'beginner').length
      const intermediate = spots.filter((s) => s.difficulty === 'intermediate').length
      const advanced     = spots.filter((s) => s.difficulty === 'advanced').length
      return { ...r, total: spots.length, beginner, intermediate, advanced }
    })
  )

  const totalSpots = regionData.reduce((sum, r) => sum + r.total, 0)

  return (
    <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>
      {/* Header */}
      <div
        className="border-b"
        style={{ background: 'white', borderColor: 'var(--border)' }}
      >
        <div className="mx-auto max-w-6xl px-5 py-12">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--ocean-500)' }}>
            California
          </p>
          <h1
            className="text-4xl font-bold leading-tight"
            style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
          >
            Browse by Region
          </h1>
          <p className="mt-3 text-base" style={{ color: 'var(--text-2)', maxWidth: '520px' }}>
            {totalSpots} surf spots across 8 California regions — from the Mexican border
            to the Lost Coast. Pick a region to see all its breaks, conditions, and forecasts.
          </p>
        </div>
      </div>

      {/* Region grid */}
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {regionData.map((r) => (
            <Link
              key={r.name}
              href={`/spots?region=${r.slug}`}
              className="group rounded-2xl overflow-hidden flex flex-col transition-all hover:-translate-y-1 hover:shadow-lg"
              style={{ background: 'white', border: `1px solid ${r.border}`, textDecoration: 'none' }}
            >
              {/* Color band */}
              <div
                className="px-5 pt-5 pb-4"
                style={{ background: r.bg, borderBottom: `1px solid ${r.border}` }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span style={{ fontSize: '28px', lineHeight: 1 }}>{r.icon}</span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ background: r.border, color: r.color }}
                  >
                    {r.total} spots
                  </span>
                </div>
                <h2
                  className="font-bold text-lg leading-tight"
                  style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
                >
                  {r.name}
                </h2>
              </div>

              {/* Body */}
              <div className="px-5 py-4 flex flex-col gap-4 flex-1">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {r.desc}
                </p>

                {/* Difficulty breakdown */}
                <div className="flex flex-wrap gap-1.5">
                  {r.beginner > 0 && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                      {r.beginner} beginner
                    </span>
                  )}
                  {r.intermediate > 0 && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
                      {r.intermediate} intermediate
                    </span>
                  )}
                  {r.advanced > 0 && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                      {r.advanced} advanced
                    </span>
                  )}
                </div>

                {/* Difficulty bar */}
                {r.total > 0 && (
                  <div className="h-1.5 w-full rounded-full overflow-hidden flex" style={{ background: 'var(--sand-100)' }}>
                    <div style={{ width: `${(r.beginner / r.total) * 100}%`, background: '#16a34a' }} />
                    <div style={{ width: `${(r.intermediate / r.total) * 100}%`, background: '#f59e0b' }} />
                    <div style={{ width: `${(r.advanced / r.total) * 100}%`, background: '#ef4444' }} />
                  </div>
                )}

                {/* Footer link */}
                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold" style={{ color: r.color }}>
                    View all spots →
                  </span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={r.color} strokeWidth="2" strokeLinecap="round"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Explore all link */}
        <div className="mt-10 text-center">
          <Link
            href="/spots"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: 'var(--ocean-600)' }}
          >
            🗺️ Open live map — all {totalSpots} spots
          </Link>
        </div>
      </div>
    </div>
  )
}
