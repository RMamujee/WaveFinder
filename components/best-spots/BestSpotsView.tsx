'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

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
}

interface SwellHour {
  time: string
  swellHeight: number
  swellPeriod: number
  swellDirection: number
  swellDirectionLabel: string
  windWaveHeight: number
  windWavePeriod: number
  windWaveDirection: number
  windWaveDirectionLabel: string
  waveHeight: number
  wavePeriod: number
  windSpeed: number
  windDirection: number
  windDirectionLabel: string
}

interface BestSpotsResponse {
  spots: SpotEntry[]
  regionalSwell: SwellHour[]
  date: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CA_REGIONS = [
  'Los Angeles',
  'Santa Barbara',
  'Ventura',
  'Orange County',
  'San Diego',
  'Central Coast',
  'Monterey',
  'NorCal',
]

const SWELL_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#f97316']

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLocalDateStr(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDateLabel(dateStr: string): string {
  const todayStr = getLocalDateStr(0)
  const tomorrowStr = getLocalDateStr(1)
  if (dateStr === todayStr) return 'Today'
  if (dateStr === tomorrowStr) return 'Tomorrow'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatHour(h: number): string {
  if (h === 12) return '12:00 PM'
  if (h < 12) return `${h}:00 AM`
  return `${h - 12}:00 PM`
}

function mToFtStr(m: number): string {
  return (m * 3.281).toFixed(1) + 'ft'
}

function kmhToKnots(kmh: number): number {
  return Math.round(kmh * 0.5399)
}

function windIntensity(kmh: number): string {
  const kts = kmhToKnots(kmh)
  if (kts < 3)  return 'Calm'
  if (kts < 8)  return 'Light'
  if (kts < 13) return 'Mild'
  if (kts < 18) return 'Moderate'
  if (kts < 25) return 'Strong'
  return 'Gale'
}

function periodLabel(p: number): string {
  if (p < 8)  return 'short period'
  if (p < 12) return 'medium period'
  return 'long period'
}

function getHourFromTime(time: string): number {
  return parseInt(time.slice(11, 13), 10)
}

function scoreColor(score: number): string {
  if (score >= 80) return '#a78bfa'
  if (score >= 55) return '#4ade80'
  if (score >= 30) return '#fbbf24'
  return '#9ca3af'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BestSpotsView() {
  const [selectedRegion, setSelectedRegion] = useState('Los Angeles')
  const [selectedDate,   setSelectedDate]   = useState(() => getLocalDateStr(0))
  const [selectedHour,   setSelectedHour]   = useState(() => {
    const h = new Date().getHours()
    return Math.max(7, Math.min(19, h))
  })

  // 7-day date strip
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => getLocalDateStr(i)),
    []
  )

  // Fetch best-spots data
  const { data, isLoading, isError } = useQuery<BestSpotsResponse>({
    queryKey: ['best-spots', selectedRegion, selectedDate],
    queryFn: () =>
      fetch(`/api/best-spots?region=${encodeURIComponent(selectedRegion)}&date=${selectedDate}`)
        .then((r) => {
          if (!r.ok) throw new Error('API error')
          return r.json()
        }),
    staleTime: 30 * 60 * 1000,
  })

  // Current regional swell at selected hour
  const currentSwell = useMemo<SwellHour | null>(() => {
    if (!data?.regionalSwell?.length) return null
    return (
      data.regionalSwell.find((h) => getHourFromTime(h.time) === selectedHour) ??
      data.regionalSwell[0]
    )
  }, [data, selectedHour])

  // Spots sorted by score at selected hour
  const sortedSpots = useMemo(() => {
    if (!data?.spots?.length) return []
    return data.spots
      .map((spot) => {
        const hour =
          spot.hours.find((h) => getHourFromTime(h.time) === selectedHour) ??
          spot.hours[0]
        return { ...spot, h: hour }
      })
      .filter((s) => s.h)
      .sort((a, b) => (b.h?.ratingScore ?? 0) - (a.h?.ratingScore ?? 0))
  }, [data, selectedHour])

  // Rating counts
  const { epicCount, goodCount } = useMemo(() => {
    let epicCount = 0, goodCount = 0
    sortedSpots.forEach((s) => {
      if (s.h?.rating === 'epic') epicCount++
      else if (s.h?.rating === 'good') goodCount++
    })
    return { epicCount, goodCount }
  }, [sortedSpots])

  // Swell components sorted by energy (H² × T)
  const swellComponents = useMemo(() => {
    if (!currentSwell) return []
    const comps = [
      {
        label:   'Primary',
        height:  currentSwell.swellHeight,
        period:  currentSwell.swellPeriod,
        dir:     currentSwell.swellDirection,
        dirLbl:  currentSwell.swellDirectionLabel,
      },
      {
        label:   'Secondary',
        height:  currentSwell.windWaveHeight,
        period:  currentSwell.windWavePeriod,
        dir:     currentSwell.windWaveDirection,
        dirLbl:  currentSwell.windWaveDirectionLabel,
      },
    ]
    return comps
      .filter((c) => c.height > 0)
      .sort((a, b) => b.height ** 2 * b.period - a.height ** 2 * a.period)
  }, [currentSwell])

  const titleDateLabel = getDateLabel(selectedDate)

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 57px)',
        background: '#111111',
        color: '#e5e7eb',
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Title */}
        <h1
          className="text-2xl font-bold text-center mb-6"
          style={{ color: '#ffffff', letterSpacing: '-0.02em' }}
        >
          Best Spots{' '}
          <span style={{ color: '#8b8b9a', fontWeight: 400 }}>|</span>{' '}
          {titleDateLabel}
        </h1>

        {/* Region pills */}
        <div className="flex gap-2 flex-wrap justify-center mb-4">
          {CA_REGIONS.map((region) => {
            const active = region === selectedRegion
            return (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                style={{
                  border: `1px solid ${active ? '#3b82f6' : '#2d2d2d'}`,
                  background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color:      active ? '#60a5fa' : '#9ca3af',
                }}
              >
                {region}
              </button>
            )
          })}
        </div>

        {/* Date pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 justify-center">
          {dates.map((date) => {
            const active = date === selectedDate
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className="rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all"
                style={{
                  border: `1px solid ${active ? '#3b82f6' : '#2d2d2d'}`,
                  background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color:      active ? '#60a5fa' : '#9ca3af',
                }}
              >
                {getDateLabel(date)}
              </button>
            )
          })}
        </div>

        {/* Time slider card */}
        <div
          className="rounded-2xl mb-5 p-6"
          style={{ background: '#1a1a1a', border: '1px solid #262626' }}
        >
          {/* Clock */}
          <div className="text-center mb-1">
            <div
              className="font-light mb-1"
              style={{ fontSize: '52px', lineHeight: 1, color: '#ffffff', letterSpacing: '-0.03em' }}
            >
              {formatHour(selectedHour)}
            </div>
            <div className="text-sm" style={{ color: '#9ca3af' }}>
              {epicCount} Best · {goodCount} Good
            </div>
          </div>

          {/* Range slider */}
          <div className="mt-5 px-1">
            <input
              type="range"
              min={7}
              max={19}
              step={1}
              value={selectedHour}
              onChange={(e) => setSelectedHour(parseInt(e.target.value, 10))}
              className="w-full"
              style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: '#8b8b9a' }}>7:00 AM</span>
              <span className="text-xs" style={{ color: '#8b8b9a' }}>7:00 PM</span>
            </div>
          </div>

          {/* Swell components */}
          {swellComponents.length > 0 && (
            <div
              className="mt-5 rounded-xl p-4 space-y-3"
              style={{ background: '#141414', border: '1px solid #222222' }}
            >
              {swellComponents.map((comp, idx) => (
                <div key={comp.label} className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 rounded-full mt-1"
                    style={{
                      width: 3,
                      height: 18,
                      background: SWELL_COLORS[idx] ?? '#9ca3af',
                    }}
                  />
                  <p className="text-sm leading-snug">
                    <span
                      className="font-semibold"
                      style={{ color: SWELL_COLORS[idx] ?? '#9ca3af' }}
                    >
                      {comp.label}:
                    </span>{' '}
                    <span style={{ color: '#e5e7eb' }}>
                      {mToFtStr(comp.height)}{' '}
                      {comp.dirLbl} ({comp.dir}°) @{' '}
                      {comp.period.toFixed(1)}s
                    </span>{' '}
                    <span style={{ color: '#9ca3af' }}>
                      ({periodLabel(comp.period)})
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spot table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#1a1a1a', border: '1px solid #262626' }}
        >
          {/* Header row */}
          <div
            className="grid items-center px-5 py-3 text-xs font-semibold tracking-widest uppercase"
            style={{
              gridTemplateColumns: '1fr 160px 72px 72px 72px',
              color: '#8b8b9a',
              borderBottom: '1px solid #222222',
            }}
          >
            <span>Spot</span>
            <span className="text-right">Wind</span>
            <span className="text-right">Tide</span>
            <span className="text-right">Waves</span>
            <span className="text-right">Score</span>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="py-20 flex flex-col items-center gap-3">
              <div
                className="h-6 w-6 rounded-full border-2 animate-spin"
                style={{ borderColor: '#262626', borderTopColor: '#3b82f6' }}
              />
              <span className="text-sm" style={{ color: '#8b8b9a' }}>
                Fetching conditions…
              </span>
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <div className="py-20 text-center text-sm" style={{ color: '#ef4444' }}>
              Could not load conditions for {selectedRegion}. Try another region or date.
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && sortedSpots.length === 0 && (
            <div className="py-20 text-center text-sm" style={{ color: '#8b8b9a' }}>
              No spots found for {selectedRegion}.
            </div>
          )}

          {/* Spot rows */}
          {!isLoading &&
            sortedSpots.map((spot, idx) => {
              const h = spot.h!
              const kts  = kmhToKnots(h.windSpeed)
              const sc   = (h.ratingScore / 10).toFixed(1)
              const isLast = idx === sortedSpots.length - 1

              return (
                <Link
                  key={spot.id}
                  href={`/spots/${spot.slug}`}
                  className="grid items-center px-5 py-4 transition-colors"
                  style={{
                    gridTemplateColumns: '1fr 160px 72px 72px 72px',
                    textDecoration: 'none',
                    borderBottom: isLast ? 'none' : '1px solid #1e1e1e',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#202020')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Spot name */}
                  <span
                    className="font-semibold text-sm truncate pr-3"
                    style={{ color: '#f3f4f6' }}
                    title={spot.name}
                  >
                    {spot.name}
                  </span>

                  {/* Wind */}
                  <span
                    className="text-sm text-right"
                    style={{ color: '#f59e0b' }}
                  >
                    {windIntensity(h.windSpeed)} {h.windDirectionLabel} {kts}kts
                  </span>

                  {/* Tide (no per-spot tide data in this view) */}
                  <span
                    className="text-sm text-right"
                    style={{ color: '#8b8b9a' }}
                  >
                    —
                  </span>

                  {/* Waves */}
                  <span
                    className="text-sm text-right font-semibold"
                    style={{ color: '#60a5fa', fontSize: '15px' }}
                  >
                    {mToFtStr(h.waveHeight)}
                  </span>

                  {/* Score */}
                  <span
                    className="text-right font-bold"
                    style={{ color: scoreColor(h.ratingScore), fontSize: '15px' }}
                  >
                    {sc}/10
                  </span>
                </Link>
              )
            })}
        </div>

        {/* Footer note */}
        {!isLoading && sortedSpots.length > 0 && (
          <p className="text-center text-xs mt-4" style={{ color: '#9ca3af' }}>
            Scores computed from regional swell model · waves in feet · wind in knots
          </p>
        )}
      </div>
    </div>
  )
}
