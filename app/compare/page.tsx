'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { SurfSpot } from '@/types/spot'
import type { SpotForecast, ConditionRating, ForecastDay } from '@/types/forecast'
import { degreesToCompass } from '@/lib/forecast/rating'

// ── Shared style maps ─────────────────────────────────────────────────────────

const RATING_STYLES: Record<ConditionRating, { bg: string; border: string; text: string; accent: string }> = {
  poor: { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', accent: '#9ca3af' },
  fair: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', accent: '#f59e0b' },
  good: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', accent: '#16a34a' },
  epic: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', accent: '#7c3aed' },
}

const DIFFICULTY_STYLES: Record<string, { color: string; bg: string }> = {
  beginner:     { color: '#15803d', bg: '#f0fdf4' },
  intermediate: { color: '#b45309', bg: '#fffbeb' },
  advanced:     { color: '#b91c1c', bg: '#fef2f2' },
}

const DAY_RATING_ACCENT: Record<ConditionRating, string> = {
  poor: '#9ca3af',
  fair: '#f59e0b',
  good: '#16a34a',
  epic: '#7c3aed',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function metersToFeet(m: number): string {
  return `${Math.round(m * 3.281)}ft`
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SpotSelectorProps {
  index: number
  value: string
  spots: SurfSpot[]
  onChange: (slug: string) => void
  isLoading: boolean
}

function SpotSelector({ index, value, spots, onChange, isLoading }: SpotSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={`spot-select-${index}`}
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-3)' }}
      >
        Spot {index + 1}
      </label>
      <div className="relative">
        {/* Chevron icon */}
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        <select
          id={`spot-select-${index}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          className="w-full appearance-none rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium focus:outline-none transition-all"
          style={{
            background: value ? 'var(--ocean-50)' : 'var(--sand-100)',
            border: `1.5px solid ${value ? 'var(--ocean-300)' : 'var(--border)'}`,
            color: value ? 'var(--text)' : 'var(--text-3)',
            cursor: 'pointer',
          }}
        >
          <option value="">— Select a spot —</option>
          {spots.map((spot) => (
            <option key={spot.slug} value={spot.slug}>
              {spot.name} · {spot.region}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

interface MiniDayCardProps {
  day: ForecastDay
}

function MiniDayCard({ day }: MiniDayCardProps) {
  const accent = DAY_RATING_ACCENT[day.dominantRating]
  return (
    <div
      className="flex flex-col items-center rounded-xl py-2 px-1.5 min-w-0"
      style={{
        background: RATING_STYLES[day.dominantRating].bg,
        border: `1px solid ${RATING_STYLES[day.dominantRating].border}`,
      }}
    >
      <span className="text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>
        {shortDay(day.date)}
      </span>
      <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
        {metersToFeet(day.maxWaveHeight)}
      </span>
      <div
        className="mt-1.5 h-1 w-full rounded-full"
        style={{ background: 'rgba(0,0,0,0.08)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, (day.maxWaveHeight / 4) * 100)}%`,
            background: accent,
          }}
        />
      </div>
      <span
        className="mt-1.5 text-xs font-semibold uppercase"
        style={{ color: accent, fontSize: '9px', letterSpacing: '0.04em' }}
      >
        {day.dominantRating}
      </span>
    </div>
  )
}

interface SpotColumnProps {
  spot: SurfSpot
  forecast: SpotForecast | undefined
  isLoading: boolean
  isError: boolean
}

function SpotColumn({ spot, forecast, isLoading, isError }: SpotColumnProps) {
  const current = forecast?.currentCondition
  const ratingStyle = current ? RATING_STYLES[current.rating] : RATING_STYLES.poor
  const diffStyle = DIFFICULTY_STYLES[spot.difficulty] ?? DIFFICULTY_STYLES.intermediate

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderTop: `3px solid var(--ocean-400)`,
        minWidth: 0,
      }}
    >
      {/* Spot header */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <a
            href={`/spots/${spot.slug}`}
            className="font-bold text-base leading-tight hover:underline"
            style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}
          >
            {spot.name}
          </a>
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
            style={{ background: diffStyle.bg, color: diffStyle.color }}
          >
            {spot.difficulty}
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          {spot.region}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-4 space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            {[80, 60, 70, 50].map((w, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg h-6"
                style={{ background: 'var(--sand-100)', width: `${w}%` }}
              />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-center py-6" style={{ color: '#ef4444' }}>
            Failed to load forecast
          </p>
        ) : !current ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>
            No current data available
          </p>
        ) : (
          <>
            {/* Rating badge */}
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: ratingStyle.bg, border: `1px solid ${ratingStyle.border}` }}
            >
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: ratingStyle.text }}>
                  Conditions
                </p>
                <p
                  className="font-black uppercase tracking-wide"
                  style={{ color: ratingStyle.text, fontSize: '18px', fontFamily: 'Playfair Display, serif' }}
                >
                  {current.rating === 'epic' ? 'EPIC' : current.rating.charAt(0).toUpperCase() + current.rating.slice(1)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium mb-0.5" style={{ color: ratingStyle.text }}>Score</p>
                <p className="text-2xl font-black" style={{ color: ratingStyle.accent }}>
                  {current.ratingScore}
                </p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Wave height */}
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Wave Height</p>
                <p className="font-bold text-lg" style={{ color: 'var(--text)', lineHeight: 1 }}>
                  {metersToFeet(current.waveHeight)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {current.waveHeight.toFixed(1)}m
                </p>
              </div>

              {/* Swell period */}
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Swell Period</p>
                <p className="font-bold text-lg" style={{ color: 'var(--text)', lineHeight: 1 }}>
                  {Math.round(current.swellPeriod)}s
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {degreesToCompass(current.swellDirection)}
                </p>
              </div>

              {/* Wind */}
              <div className="col-span-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Wind</p>
                <div className="flex items-baseline gap-2">
                  <p className="font-bold text-lg" style={{ color: 'var(--text)', lineHeight: 1 }}>
                    {Math.round(current.wind.speed)} km/h
                  </p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                    {current.wind.directionLabel}
                  </p>
                </div>
              </div>
            </div>

            {/* 7-day mini strip */}
            {forecast?.forecast && forecast.forecast.length > 0 && (
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: 'var(--text-3)' }}
                >
                  7-Day Outlook
                </p>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${forecast.forecast.length}, minmax(0, 1fr))` }}>
                  {forecast.forecast.map((day) => (
                    <MiniDayCard key={day.date} day={day} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Spot forecast hook ────────────────────────────────────────────────────────

function useSpotForecast(slug: string) {
  return useQuery<SpotForecast>({
    queryKey: ['forecast', slug],
    queryFn: () => fetch(`/api/forecast/${slug}`).then((r) => r.json()),
    enabled: !!slug,
    staleTime: 30 * 60 * 1000,
  })
}

// ── Connected column wrapper ──────────────────────────────────────────────────

function ConnectedSpotColumn({ slug, spots }: { slug: string; spots: SurfSpot[] }) {
  const { data: forecast, isLoading, isError } = useSpotForecast(slug)
  const spot = spots.find((s) => s.slug === slug)
  if (!spot) return null
  return <SpotColumn spot={spot} forecast={forecast} isLoading={isLoading} isError={isError} />
}

// ── Main page ─────────────────────────────────────────────────────────────────

const MAX_SPOTS = 3

export default function ComparePage() {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(['', '', ''])

  const { data: spots = [], isLoading: spotsLoading } = useQuery<SurfSpot[]>({
    queryKey: ['spots-all'],
    queryFn: () => fetch('/api/spots?limit=200').then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
  })

  const activeSlugs = selectedSlugs.filter(Boolean)
  const hasComparison = activeSlugs.length >= 2

  function handleSlugChange(index: number, slug: string) {
    setSelectedSlugs((prev) => {
      const next = [...prev]
      next[index] = slug
      return next
    })
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--sand-50)' }}>
      {/* Page header */}
      <div
        className="sticky top-[57px] z-40 border-b"
        style={{
          background: 'rgba(253,250,245,0.95)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="mx-auto max-w-7xl px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            {/* Title */}
            <div>
              <h1
                className="text-2xl font-bold leading-tight"
                style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
              >
                Compare Spots
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
                Compare conditions across multiple breaks
              </p>
            </div>

            {/* Spot selectors */}
            <div
              className="flex-1 grid gap-3 min-w-0"
              style={{ gridTemplateColumns: `repeat(${MAX_SPOTS}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: MAX_SPOTS }).map((_, i) => (
                <SpotSelector
                  key={i}
                  index={i}
                  value={selectedSlugs[i]}
                  spots={spots}
                  onChange={(slug) => handleSlugChange(i, slug)}
                  isLoading={spotsLoading}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-5 py-8">
        {!hasComparison ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: 'var(--ocean-50)', border: '2px solid var(--ocean-200)' }}
            >
              <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
                <path
                  d="M2 15 C6 10 10 8 14 11 C18 14 20 9 24 8 C28 7 32 10 36 12 C38 13 40 13.5 40 13.5"
                  stroke="var(--ocean-400)" strokeWidth="2.5" strokeLinecap="round"
                />
                <path
                  d="M2 22 C6 18 10 17 14 19 C18 21 20 17.5 24 16.5 C28 15.5 32 17.5 36 19"
                  stroke="var(--seafoam)" strokeWidth="2" strokeLinecap="round" opacity="0.7"
                />
              </svg>
            </div>
            <h2
              className="text-xl font-bold mb-2"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
            >
              Select at least 2 spots to compare
            </h2>
            <p className="text-sm max-w-sm" style={{ color: 'var(--text-3)' }}>
              Choose spots from the dropdowns above to see their current conditions and 7-day forecasts side by side.
            </p>
          </div>
        ) : (
          /* Comparison columns */
          <div
            className="grid gap-5"
            style={{
              gridTemplateColumns: `repeat(${activeSlugs.length}, minmax(0, 1fr))`,
            }}
          >
            {activeSlugs.map((slug) => (
              <ConnectedSpotColumn key={slug} slug={slug} spots={spots} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
