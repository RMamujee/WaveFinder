'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { REGION_HIERARCHY } from '@/lib/region-hierarchy'
import { Icon } from '@/components/ui/Icon'

// ── Visual config ─────────────────────────────────────────────────────────────

const WORLD_REGION_COLORS: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  'North America': { color: '#1b7fcb', bg: '#eff6ff', border: '#bfdbfe', icon: 'wave' },
  'South America': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: 'surfer' },
  'Europe':        { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: '🌅' },
  'Oceania':       { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', icon: '🤙' },
  'Asia':          { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '🐉' },
  'Africa':        { color: '#b45309', bg: '#fef3c7', border: '#fde68a', icon: '🌍' },
}

const CARD_COLORS: string[] = [
  '#1b7fcb', '#d97706', '#7c3aed', '#0891b2', '#059669', '#b45309',
  '#374151', '#15803d', '#b91c1c', '#0e7490',
]

function getCardStyle(idx: number) {
  const color = CARD_COLORS[idx % CARD_COLORS.length]
  return { color, bg: '#f9fafb', border: '#e5e7eb' }
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

interface BreadcrumbProps {
  worldRegion: string | null
  country: string | null
  state: string | null
  onSelectWorld: () => void
  onSelectRegion: () => void
  onSelectCountry: () => void
}

function Breadcrumb({ worldRegion, country, state, onSelectWorld, onSelectRegion, onSelectCountry }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-sm">
      <button onClick={onSelectWorld} className="font-semibold hover:underline"
        style={{ color: worldRegion ? 'var(--ocean-600)' : 'var(--text)' }}>
        World
      </button>
      {worldRegion && (
        <>
          <span style={{ color: 'var(--text-3)' }}>/</span>
          <button onClick={onSelectRegion} className="font-semibold hover:underline"
            style={{ color: country ? 'var(--ocean-600)' : 'var(--text)' }}>
            {worldRegion}
          </button>
        </>
      )}
      {country && (
        <>
          <span style={{ color: 'var(--text-3)' }}>/</span>
          <button onClick={onSelectCountry} className="font-semibold hover:underline"
            style={{ color: state ? 'var(--ocean-600)' : 'var(--text)' }}>
            {country}
          </button>
        </>
      )}
      {state && (
        <>
          <span style={{ color: 'var(--text-3)' }}>/</span>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>{state}</span>
        </>
      )}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  title: string
  subtitle?: string
  icon: string
  color: string
  bg: string
  border: string
  description?: string
  onClick?: () => void
  href?: string
}

function RegionCard({ title, subtitle, icon, color, bg, border, description, onClick, href }: CardProps) {
  const inner = (
    <div
      className="group rounded-2xl overflow-hidden flex flex-col transition-all hover:-translate-y-1 hover:shadow-lg"
      style={{ background: 'white', border: `1px solid ${border}`, cursor: onClick || href ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div className="px-5 pt-5 pb-4" style={{ background: bg, borderBottom: `1px solid ${border}` }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span style={{ lineHeight: 1 }}>
            {['wave','surfer','map','pin','star','buoy','tide','wind','sun','moon','compass','temp'].includes(icon)
              ? <Icon name={icon as import('@/components/ui/Icon').IconName} size={28} strokeWidth={1.4} style={{ color }} />
              : <span style={{ fontSize: '28px' }}>{icon}</span>
            }
          </span>
          {subtitle && (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: border, color }}>
              {subtitle}
            </span>
          )}
        </div>
        <h2 className="font-bold text-lg leading-tight" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
          {title}
        </h2>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3 flex-1">
        {description && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-xs font-semibold" style={{ color }}>
            {href ? 'View spots →' : 'Explore →'}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
            className="transition-transform group-hover:translate-x-1">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  )

  if (href) return <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link>
  return inner
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RegionsPage() {
  const [selectedWorldRegion, setSelectedWorldRegion] = useState<string | null>(null)
  const [selectedCountry, setSelectedCountry]         = useState<string | null>(null)
  const [selectedState, setSelectedState]             = useState<string | null>(null)

  const { data: metaCountries = [] } = useQuery<string[]>({
    queryKey: ['meta-countries'],
    queryFn: () => fetch('/api/spots/meta').then(r => r.json()).then(d => d.countries ?? []),
    staleTime: 60 * 60 * 1000,
  })

  const { data: regionMeta } = useQuery<{ regions: string[] }>({
    queryKey: ['meta-regions', selectedCountry],
    queryFn: () => fetch(`/api/spots/meta?country=${encodeURIComponent(selectedCountry!)}`).then(r => r.json()),
    enabled: !!selectedCountry,
    staleTime: 60 * 60 * 1000,
  })
  const dbRegions = regionMeta?.regions ?? []

  const worldRegions = Object.keys(REGION_HIERARCHY)
  const countriesInWorldRegion = selectedWorldRegion ? Object.keys(REGION_HIERARCHY[selectedWorldRegion] ?? {}) : []
  const statesInCountry = (selectedWorldRegion && selectedCountry)
    ? Object.keys(REGION_HIERARCHY[selectedWorldRegion]?.[selectedCountry] ?? {}) : []
  const regionsInState = (selectedWorldRegion && selectedCountry && selectedState)
    ? (REGION_HIERARCHY[selectedWorldRegion]?.[selectedCountry]?.[selectedState] ?? []) : []

  const pageTitle = selectedState ?? selectedCountry ?? selectedWorldRegion ?? 'Browse by Region'
  const pageSubtitle = selectedState
    ? `Local surf regions in ${selectedState}, ${selectedCountry}`
    : selectedCountry
      ? `States & provinces with surf in ${selectedCountry}`
      : selectedWorldRegion
        ? `Countries with surf in ${selectedWorldRegion}`
        : 'Explore surf destinations worldwide'

  return (
    <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="border-b" style={{ background: 'white', borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="mb-4">
            <Breadcrumb
              worldRegion={selectedWorldRegion}
              country={selectedCountry}
              state={selectedState}
              onSelectWorld={() => { setSelectedWorldRegion(null); setSelectedCountry(null); setSelectedState(null) }}
              onSelectRegion={() => { setSelectedCountry(null); setSelectedState(null) }}
              onSelectCountry={() => setSelectedState(null)}
            />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--ocean-500)' }}>
            {selectedState ? selectedCountry : selectedCountry ? selectedWorldRegion : 'Worldwide'}
          </p>
          <h1 className="text-4xl font-bold leading-tight" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            {pageTitle}
          </h1>
          <p className="mt-2 text-base" style={{ color: 'var(--text-2)', maxWidth: '520px' }}>
            {pageSubtitle}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10">

        {/* Level 1: World regions */}
        {!selectedWorldRegion && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {worldRegions.map((wr) => {
              const cfg = WORLD_REGION_COLORS[wr] ?? { color: '#374151', bg: '#f9fafb', border: '#e5e7eb', icon: '🌐' }
              const countries = Object.keys(REGION_HIERARCHY[wr])
              return (
                <RegionCard
                  key={wr}
                  title={wr}
                  subtitle={`${countries.length} countries`}
                  icon={cfg.icon}
                  color={cfg.color}
                  bg={cfg.bg}
                  border={cfg.border}
                  description={`Discover surf destinations across ${wr}`}
                  onClick={() => setSelectedWorldRegion(wr)}
                />
              )
            })}
          </div>
        )}

        {/* Level 2: Countries */}
        {selectedWorldRegion && !selectedCountry && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {countriesInWorldRegion.map((country, idx) => {
              const style = getCardStyle(idx)
              const hasData = metaCountries.includes(country)
              const states = Object.keys(REGION_HIERARCHY[selectedWorldRegion]?.[country] ?? {})
              return (
                <RegionCard
                  key={country}
                  title={country}
                  subtitle={`${states.length} region${states.length !== 1 ? 's' : ''}`}
                  icon={hasData ? 'surfer' : 'map'}
                  color={hasData ? '#1b7fcb' : style.color}
                  bg={hasData ? '#eff6ff' : style.bg}
                  border={hasData ? '#bfdbfe' : style.border}
                  description={hasData ? 'Live surf data available' : 'Spots coming soon'}
                  onClick={() => setSelectedCountry(country)}
                />
              )
            })}
          </div>
        )}

        {/* Level 3: States / Provinces */}
        {selectedWorldRegion && selectedCountry && !selectedState && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {statesInCountry.map((state, idx) => {
              const style = getCardStyle(idx)
              const regions = REGION_HIERARCHY[selectedWorldRegion]?.[selectedCountry]?.[state] ?? []
              return (
                <RegionCard
                  key={state}
                  title={state}
                  subtitle={`${regions.length} region${regions.length !== 1 ? 's' : ''}`}
                  icon="surfer"
                  color={style.color}
                  bg={style.bg}
                  border={style.border}
                  description={`Surf breaks in ${state}`}
                  onClick={() => setSelectedState(state)}
                />
              )
            })}
          </div>
        )}

        {/* Level 4: Local regions */}
        {selectedWorldRegion && selectedCountry && selectedState && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {regionsInState.map((region, idx) => {
              const style = getCardStyle(idx)
              // DB regions are stored as "City, RegionName" so check if any DB region contains the local region name
              const hasData = dbRegions.some((r) =>
                r.toLowerCase().includes(region.toLowerCase()) ||
                region.toLowerCase().includes(r.toLowerCase())
              )
              return (
                <RegionCard
                  key={region}
                  title={region}
                  icon={hasData ? 'wave' : 'pin'}
                  color={hasData ? '#1b7fcb' : style.color}
                  bg={hasData ? '#eff6ff' : style.bg}
                  border={hasData ? '#bfdbfe' : style.border}
                  description={hasData ? 'Live conditions available' : 'Explore spots'}
                  href={`/spots?country=${encodeURIComponent(selectedCountry)}&region=${encodeURIComponent(region)}`}
                />
              )
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/spots"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: 'var(--ocean-600)' }}
          >
            <Icon name="map" size={14} strokeWidth={1.8} /> Open live map — all spots
          </Link>
        </div>
      </div>
    </div>
  )
}
