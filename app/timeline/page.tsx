'use client'

import { useState, useMemo } from 'react'
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLocalDateStr(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  )
}

function hourFromTimeStr(time: string): number {
  return parseInt(time.slice(11, 13), 10)
}

function dayLabel(dateStr: string, idx: number): string {
  if (idx === 0) return 'Today'
  if (idx === 1) return 'Tomorrow'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function hourLabel(h: number): string {
  if (h === 0)   return '12 AM'
  if (h < 12)    return `${h} AM`
  if (h === 12)  return '12 PM'
  return `${h - 12} PM`
}

function scoreToColor(score: number): string {
  if (score >= 75) return '#7c3aed' // epic – purple
  if (score >= 55) return '#1b7fcb' // great – blue
  if (score >= 35) return '#059669' // good  – green
  if (score >= 20) return '#d97706' // fair  – amber
  return '#9ca3af'                   // poor  – grey
}

function scoreToLabel(score: number): string {
  if (score >= 75) return 'Epic'
  if (score >= 55) return 'Great'
  if (score >= 35) return 'Good'
  if (score >= 20) return 'Fair'
  return 'Poor'
}

function scoreToRatingKey(score: number): string {
  if (score >= 75) return 'epic'
  if (score >= 55) return 'great'
  if (score >= 35) return 'good'
  if (score >= 20) return 'fair'
  return 'poor'
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
}

interface SwellHour {
  time: string
  waveHeight: number
  swellHeight: number
  swellPeriod: number
  swellDirectionLabel: string
  windSpeed: number
  windDirectionLabel: string
}

const RATING_PILL: Record<string, { bg: string; text: string; track: string }> = {
  epic:  { bg: '#7c3aed', text: 'white', track: '#ddd6fe' },
  great: { bg: '#1b7fcb', text: 'white', track: '#bfdbfe' },
  good:  { bg: '#059669', text: 'white', track: '#a7f3d0' },
  fair:  { bg: '#d97706', text: 'white', track: '#fde68a' },
  poor:  { bg: '#6b7280', text: 'white', track: '#e5e7eb' },
  flat:  { bg: '#e5e7eb', text: '#374151', track: '#f3f4f6' },
}

// ── Hourly bar chart ──────────────────────────────────────────────────────────

interface HourlyChartProps {
  /** Average score per hour, index = hour 0-23 */
  scores: number[]
  selectedHour: number
  currentHour: number
  onSelect: (h: number) => void
  isLoading: boolean
}

function HourlyChart({ scores, selectedHour, currentHour, onSelect, isLoading }: HourlyChartProps) {
  const maxScore = Math.max(...scores, 1)

  return (
    <div className="w-full">
      {/* Bar chart */}
      <div className="flex items-end gap-px" style={{ height: '80px' }}>
        {Array.from({ length: 24 }, (_, h) => {
          const score = scores[h] ?? 0
          const heightPct = isLoading ? 0 : Math.max(4, (score / maxScore) * 100)
          const color = isLoading ? '#e5e7eb' : scoreToColor(score)
          const isSelected = h === selectedHour
          const isCurrent = h === currentHour

          return (
            <button
              key={h}
              className="flex-1 rounded-t-sm transition-all duration-150 relative focus:outline-none"
              style={{
                height: `${heightPct}%`,
                background: isSelected ? color : isLoading ? '#f3f4f6' : color + 'bb',
                transform: isSelected ? 'scaleY(1.06)' : 'scaleY(1)',
                transformOrigin: 'bottom',
                boxShadow: isSelected ? `0 -2px 8px ${color}66` : 'none',
              }}
              onClick={() => onSelect(h)}
              title={isLoading ? '' : `${hourLabel(h)}: ${scoreToLabel(score)} (${Math.round(score)}/100)`}
            >
              {isCurrent && (
                <div
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: '#f97316' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-1 px-0">
        {[0, 6, 12, 18, 23].map((h) => (
          <span
            key={h}
            className="text-xs"
            style={{ color: 'var(--text-3)', fontSize: '10px' }}
          >
            {hourLabel(h)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Spot row ──────────────────────────────────────────────────────────────────

function SpotRow({ spot, rank, hour }: { spot: SpotEntry; rank: number; hour: number }) {
  const hourData = spot.hours.find((h) => hourFromTimeStr(h.time) === hour) ?? spot.hours[0]
  if (!hourData) return null

  const rc = RATING_PILL[hourData.rating] ?? RATING_PILL.poor

  return (
    <Link
      href={`/spots/${spot.slug}`}
      className="group flex items-center gap-4 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: 'white', border: '1px solid var(--border)', textDecoration: 'none' }}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
        style={{
          background: rank <= 3 ? 'var(--ocean-600)' : 'var(--sand-100)',
          color:      rank <= 3 ? 'white' : 'var(--text-3)',
        }}
      >
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
          {spot.name}
        </div>
        <div className="text-xs mt-0.5 flex gap-2" style={{ color: 'var(--text-3)' }}>
          <span>{hourData.waveHeight.toFixed(1)} m waves</span>
          <span>·</span>
          <span>{hourData.windDirectionLabel} {Math.round(hourData.windSpeed)} km/h</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="hidden sm:flex flex-col gap-1 w-28">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: rc.track }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, hourData.ratingScore)}%`, background: rc.bg }}
          />
        </div>
        <div className="text-xs" style={{ color: 'var(--text-3)' }}>
          {Math.round(hourData.ratingScore)}/100
        </div>
      </div>

      <div
        className="flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold capitalize"
        style={{ background: rc.bg, color: rc.text }}
      >
        {scoreToLabel(hourData.ratingScore)}
      </div>

      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round"
        className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
        style={{ color: 'var(--text-3)' }}>
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const currentHour = new Date().getHours()

  const [region,  setRegion]  = useState('San Diego')
  const [dayIdx,  setDayIdx]  = useState(0)
  const [hour,    setHour]    = useState(currentHour)

  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => getLocalDateStr(i)),
    []
  )
  const selectedDate = dates[dayIdx]

  const { data, isLoading, isError } = useQuery({
    queryKey: ['timeline', region, selectedDate],
    queryFn: () =>
      fetch(`/api/best-spots?region=${encodeURIComponent(region)}&date=${selectedDate}`)
        .then((r) => {
          if (!r.ok) throw new Error(`API ${r.status}`)
          return r.json()
        }),
    staleTime: 30 * 60 * 1000,
    retry: 2,
  })

  const spots: SpotEntry[]   = data?.spots        ?? []
  const swell: SwellHour[]   = data?.regionalSwell ?? []

  // Per-hour average score across all spots (24 buckets)
  const hourlyScores: number[] = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => {
      if (!spots.length) return 0
      const values = spots
        .map((s) => s.hours.find((e) => hourFromTimeStr(e.time) === h)?.ratingScore ?? 0)
      return values.reduce((a, b) => a + b, 0) / values.length
    })
  }, [spots])

  // Regional swell for selected hour
  const swellNow = swell.find((s) => hourFromTimeStr(s.time) === hour) ?? swell[0]

  // Ranked spots at selected hour
  const rankedSpots = useMemo(() => {
    return spots
      .map((s) => ({
        spot: s,
        hourData: s.hours.find((h) => hourFromTimeStr(h.time) === hour) ?? s.hours[0],
      }))
      .filter((x) => x.hourData != null)
      .sort((a, b) => b.hourData!.ratingScore - a.hourData!.ratingScore)
      .map((x) => x.spot)
  }, [spots, hour])

  // Best hour derived from data
  const bestHour = hourlyScores.indexOf(Math.max(...hourlyScores))
  const avgScore = hourlyScores[hour] ?? 0
  const scoreColor = scoreToColor(avgScore)

  return (
    <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div className="border-b" style={{ background: 'white', borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-5xl px-5 py-7">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--ocean-500)' }}>
            Surf Forecast
          </p>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            Timeline
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-2)', maxWidth: '420px' }}>
            Click any hour bar to see ranked spots for that moment. The bars show real surf quality — taller and brighter means better waves.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-7 space-y-6">

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
                onChange={(e) => { setRegion(e.target.value) }}
                className="rounded-xl border px-4 py-2.5 text-sm font-medium appearance-none pr-9 cursor-pointer"
                style={{ background: 'white', borderColor: 'var(--border)', color: 'var(--text)', minWidth: '170px' }}
              >
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Day */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
              Day
            </label>
            <div className="flex gap-2 flex-wrap">
              {dates.map((dateStr, i) => (
                <button
                  key={dateStr}
                  onClick={() => setDayIdx(i)}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold transition-all"
                  style={{
                    background: dayIdx === i ? 'var(--ocean-600)' : 'white',
                    color:      dayIdx === i ? 'white' : 'var(--text-2)',
                    border:     `1px solid ${dayIdx === i ? 'var(--ocean-600)' : 'var(--border)'}`,
                  }}
                >
                  {dayLabel(dateStr, i)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Chart card ── */}
        <div className="rounded-2xl p-6 space-y-5" style={{ background: 'white', border: '1px solid var(--border)' }}>

          {/* Selected time + swell summary */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--ocean-700)' }}>
                  {hourLabel(hour)}
                </span>
                {!isLoading && avgScore > 0 && (
                  <span
                    className="rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{ background: scoreColor, color: 'white' }}
                  >
                    {scoreToLabel(avgScore)}
                  </span>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {!isLoading && spots.length > 0 && (
                  <> · Best hour: <span style={{ color: 'var(--ocean-600)', fontWeight: 600 }}>{hourLabel(bestHour)}</span></>
                )}
              </p>
            </div>

            {swellNow && (
              <div className="flex gap-5 flex-wrap">
                {[
                  { label: 'Waves',  val: `${swellNow.waveHeight.toFixed(1)} m`   },
                  { label: 'Period', val: `${(swellNow as any).swellPeriod?.toFixed(0) ?? '—'} s` },
                  { label: 'Wind',   val: `${Math.round(swellNow.windSpeed)} km/h ${swellNow.windDirectionLabel}` },
                  { label: 'Swell',  val: swellNow.swellDirectionLabel },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center">
                    <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{val}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bar chart */}
          <HourlyChart
            scores={hourlyScores}
            selectedHour={hour}
            currentHour={dayIdx === 0 ? currentHour : -1}
            onSelect={setHour}
            isLoading={isLoading}
          />

          {isLoading && (
            <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
              Loading forecast from Open-Meteo…
            </p>
          )}
          {isError && (
            <p className="text-xs text-center" style={{ color: '#b91c1c' }}>
              Could not load forecast — try a different region or date.
            </p>
          )}
        </div>

        {/* ── Ranked spots ── */}
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
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--ocean-100)', borderTopColor: 'var(--ocean-600)' }} />
              <span className="text-sm" style={{ color: 'var(--text-3)' }}>Fetching conditions…</span>
            </div>
          )}

          {!isLoading && isError && (
            <div className="rounded-2xl p-5 text-sm" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
              Could not load forecast. Open-Meteo may be temporarily unavailable — try again in a moment.
            </div>
          )}

          {!isLoading && !isError && rankedSpots.length === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'white', border: '1px solid var(--border)' }}>
              <div className="text-3xl mb-3">🌊</div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>No spots found for {region}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Try a California region like San Diego or Los Angeles.</p>
            </div>
          )}

          {!isLoading && rankedSpots.length > 0 && (
            <div className="space-y-3">
              {rankedSpots.map((spot, idx) => (
                <SpotRow key={spot.id} spot={spot} rank={idx + 1} hour={hour} />
              ))}
            </div>
          )}
        </div>

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
