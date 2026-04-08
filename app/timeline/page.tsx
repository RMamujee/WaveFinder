'use client'

import { useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

// ── Constants ─────────────────────────────────────────────────────────────────

const REGIONS = [
  'San Diego',
  'Orange County',
  'Los Angeles',
  'Ventura',
  'Santa Barbara',
  'Central Coast',
  'Monterey',
  'NorCal',
  'North Shore',
  'South Shore',
  'Gold Coast',
  'Sydney Northern Beaches',
  'Uluwatu',
  'Hossegor',
  "Jeffrey's Bay",
]

const RATING_CONFIG: Record<string, { bg: string; text: string; label: string; track: string }> = {
  epic:  { bg: '#7c3aed', text: 'white', label: 'Epic',  track: '#ddd6fe' },
  great: { bg: '#1b7fcb', text: 'white', label: 'Great', track: '#bfdbfe' },
  good:  { bg: '#059669', text: 'white', label: 'Good',  track: '#a7f3d0' },
  fair:  { bg: '#d97706', text: 'white', label: 'Fair',  track: '#fde68a' },
  poor:  { bg: '#6b7280', text: 'white', label: 'Poor',  track: '#e5e7eb' },
  flat:  { bg: '#e5e7eb', text: '#374151', label: 'Flat', track: '#f3f4f6' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dayLabel(date: Date, idx: number): string {
  if (idx === 0) return 'Today'
  if (idx === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function hourLabel(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpotHour {
  time: string
  rating: string
  ratingScore: number
  waveHeight: number
  windSpeed: number
  windDirectionLabel: string
}

interface SpotEntry {
  id: string
  name: string
  slug: string
  facingDirection: number
  hours: SpotHour[]
  hourData?: SpotHour
}

interface SwellHour {
  time: string
  waveHeight: number
  swellHeight: number
  swellPeriod: number
  swellDirection: number
  swellDirectionLabel: string
  windSpeed: number
  windDirection: number
  windDirectionLabel: string
}

// ── Timeline slider ───────────────────────────────────────────────────────────

interface TimelineSliderProps {
  hour: number
  onChange: (h: number) => void
  heatmap?: number[] // 24 values 0-100 for background heat
}

function TimelineSlider({ hour, onChange, heatmap }: TimelineSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updateFromClientX = useCallback((clientX: number) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onChange(Math.round(pct * 23))
  }, [onChange])

  return (
    <div className="select-none">
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-14 rounded-2xl cursor-pointer overflow-hidden"
        style={{
          background: 'linear-gradient(to right, #0c1b3a 0%, #1b3a6b 10%, #1b7fcb 30%, #38bdf8 45%, #bae6fd 50%, #38bdf8 55%, #f97316 75%, #dc2626 85%, #0c1b3a 100%)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.25)',
        }}
        onMouseDown={(e) => { dragging.current = true; updateFromClientX(e.clientX) }}
        onMouseMove={(e) => { if (dragging.current) updateFromClientX(e.clientX) }}
        onMouseUp={() => { dragging.current = false }}
        onMouseLeave={() => { dragging.current = false }}
        onTouchStart={(e) => updateFromClientX(e.touches[0].clientX)}
        onTouchMove={(e) => { e.preventDefault(); updateFromClientX(e.touches[0].clientX) }}
      >
        {/* Heatmap overlay */}
        {heatmap && (
          <div className="absolute inset-0 flex">
            {heatmap.map((score, i) => (
              <div
                key={i}
                className="flex-1 h-full"
                style={{
                  background: score > 70
                    ? `rgba(124,58,237,${(score - 70) / 30 * 0.35})`
                    : score > 50
                      ? `rgba(27,127,203,${(score - 50) / 20 * 0.3})`
                      : 'transparent',
                }}
              />
            ))}
          </div>
        )}

        {/* Hour tick marks */}
        {[0, 6, 12, 18].map((h) => (
          <div
            key={h}
            className="absolute top-0 bottom-0 w-px opacity-30"
            style={{ left: `${(h / 23) * 100}%`, background: 'white' }}
          />
        ))}

        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
          style={{ left: `${(hour / 23) * 100}%`, transition: 'left 0.06s ease-out' }}
        >
          <div
            className="w-7 h-7 rounded-full border-3 border-white flex items-center justify-center"
            style={{
              background: 'white',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
              border: '3px solid white',
            }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--ocean-600)' }} />
          </div>
        </div>
      </div>

      {/* Hour labels */}
      <div className="relative mt-2 h-5">
        {[0, 6, 12, 18, 23].map((h) => (
          <span
            key={h}
            className="absolute text-xs font-medium -translate-x-1/2"
            style={{ left: `${(h / 23) * 100}%`, color: 'var(--text-3)' }}
          >
            {hourLabel(h)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Spot row ──────────────────────────────────────────────────────────────────

function SpotRow({ spot, rank }: { spot: SpotEntry & { hourData: SpotHour }; rank: number }) {
  const rc = RATING_CONFIG[spot.hourData.rating] ?? RATING_CONFIG.poor

  return (
    <Link
      href={`/spots/${spot.slug}`}
      className="group flex items-center gap-4 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: 'white', border: '1px solid var(--border)', textDecoration: 'none' }}
    >
      {/* Rank badge */}
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
        style={{
          background: rank <= 3 ? 'var(--ocean-600)' : 'var(--sand-100)',
          color: rank <= 3 ? 'white' : 'var(--text-3)',
        }}
      >
        {rank}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
          {spot.name}
        </div>
        <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
          <span>{spot.hourData.waveHeight.toFixed(1)}m waves</span>
          <span>·</span>
          <span>{spot.hourData.windDirectionLabel} {spot.hourData.windSpeed.toFixed(0)} km/h wind</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="hidden sm:flex flex-col gap-1 w-32">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: rc.track }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, spot.hourData.ratingScore)}%`, background: rc.bg }}
          />
        </div>
        <div className="text-xs" style={{ color: 'var(--text-3)' }}>
          Score {spot.hourData.ratingScore}/100
        </div>
      </div>

      {/* Rating pill */}
      <div
        className="flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
        style={{ background: rc.bg, color: rc.text }}
      >
        {rc.label}
      </div>

      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
        style={{ color: 'var(--text-3)' }}
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const [region, setRegion] = useState('San Diego')
  const [dayIdx, setDayIdx] = useState(0)
  const [hour, setHour] = useState(8)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })

  const selectedDate = toDateString(days[dayIdx])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['timeline', region, selectedDate],
    queryFn: () =>
      fetch(`/api/best-spots?region=${encodeURIComponent(region)}&date=${selectedDate}`)
        .then((r) => {
          if (!r.ok) throw new Error('Failed to fetch')
          return r.json()
        }),
    staleTime: 30 * 60 * 1000,
  })

  const spots: SpotEntry[] = data?.spots ?? []
  const regionalSwell: SwellHour[] = data?.regionalSwell ?? []

  // Ranked spots for selected hour
  const rankedSpots = spots
    .map((s) => ({ ...s, hourData: s.hours[hour] }))
    .filter((s) => s.hourData != null)
    .sort((a, b) => b.hourData.ratingScore - a.hourData.ratingScore) as (SpotEntry & { hourData: SpotHour })[]

  // Heatmap: average score across all spots for each hour (24 buckets)
  const heatmap: number[] = Array.from({ length: 24 }, (_, h) => {
    if (!spots.length) return 0
    const scores = spots.map((s) => s.hours[h]?.ratingScore ?? 0)
    return scores.reduce((a, b) => a + b, 0) / scores.length
  })

  const swellNow: SwellHour | undefined = regionalSwell[hour]
  const topRating = rankedSpots[0]?.hourData?.rating
  const topRc = topRating ? (RATING_CONFIG[topRating] ?? RATING_CONFIG.poor) : null

  return (
    <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="border-b" style={{ background: 'white', borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-6xl px-5 py-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--ocean-500)' }}>
            Interactive
          </p>
          <h1 className="text-3xl font-bold leading-tight" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            Spot Timeline
          </h1>
          <p className="mt-1.5 text-sm max-w-md" style={{ color: 'var(--text-2)' }}>
            Drag the timeline to explore conditions hour-by-hour. See which spots are firing at any time of day.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8 space-y-6">

        {/* ── Controls ── */}
        <div className="flex flex-wrap gap-5 items-end">
          {/* Region */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
              Region
            </label>
            <div className="relative">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="rounded-xl border px-4 py-2.5 text-sm font-medium appearance-none pr-10 cursor-pointer"
                style={{
                  background: 'white',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                  minWidth: '180px',
                }}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Day picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
              Day
            </label>
            <div className="flex gap-2 flex-wrap">
              {days.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setDayIdx(i)}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold transition-all"
                  style={{
                    background: dayIdx === i ? 'var(--ocean-600)' : 'white',
                    color: dayIdx === i ? 'white' : 'var(--text-2)',
                    border: `1px solid ${dayIdx === i ? 'var(--ocean-600)' : 'var(--border)'}`,
                  }}
                >
                  {dayLabel(d, i)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Slider card ── */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ background: 'white', border: '1px solid var(--border)' }}
        >
          {/* Time + swell info */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span
                className="text-3xl font-bold"
                style={{ fontFamily: 'Playfair Display, serif', color: 'var(--ocean-700)' }}
              >
                {hourLabel(hour)}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-3)' }}>
                {days[dayIdx].toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              {topRc && (
                <span
                  className="rounded-lg px-2.5 py-1 text-xs font-bold"
                  style={{ background: topRc.bg, color: topRc.text }}
                >
                  Best: {topRc.label}
                </span>
              )}
            </div>

            {swellNow && (
              <div className="flex gap-5">
                {[
                  { label: 'Wave Ht', value: `${swellNow.waveHeight.toFixed(1)}m` },
                  { label: 'Period', value: `${swellNow.swellPeriod.toFixed(0)}s` },
                  { label: 'Wind', value: `${swellNow.windSpeed.toFixed(0)} km/h ${swellNow.windDirectionLabel}` },
                  { label: 'Swell Dir', value: swellNow.swellDirectionLabel },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{value}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <TimelineSlider
            hour={hour}
            onChange={setHour}
            heatmap={spots.length ? heatmap : undefined}
          />
        </div>

        {/* ── Spot rankings ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              Best Spots at {hourLabel(hour)}
            </h2>
            {!isLoading && rankedSpots.length > 0 && (
              <span className="text-sm" style={{ color: 'var(--text-3)' }}>
                {rankedSpots.length} spot{rankedSpots.length !== 1 ? 's' : ''} · {region}
              </span>
            )}
          </div>

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div
                className="w-9 h-9 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--ocean-200)', borderTopColor: 'var(--ocean-600)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-3)' }}>Fetching forecast…</span>
            </div>
          )}

          {isError && (
            <div
              className="rounded-2xl p-5 text-sm"
              style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
            >
              Could not load forecast data. Try a different region or check back in a moment.
            </div>
          )}

          {!isLoading && !isError && rankedSpots.length === 0 && (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ background: 'white', border: '1px solid var(--border)' }}
            >
              <div className="text-3xl mb-3">🌊</div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>No spots found</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                No data available for {region} on this date.
              </p>
            </div>
          )}

          {!isLoading && rankedSpots.length > 0 && (
            <div className="space-y-3">
              {rankedSpots.map((spot, idx) => (
                <SpotRow key={spot.id} spot={spot} rank={idx + 1} />
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="pt-2 text-center">
          <Link
            href="/spots"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: 'var(--ocean-600)' }}
          >
            🗺️ Open live map
          </Link>
        </div>
      </div>
    </div>
  )
}
