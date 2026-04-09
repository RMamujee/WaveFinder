'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

// ── Constants ─────────────────────────────────────────────────────────────────

const REGIONS = [
  'San Diego', 'Orange County', 'Los Angeles', 'Ventura',
  'Santa Barbara', 'Central Coast', 'Monterey', 'NorCal',
  'North Shore', 'South Shore', 'Gold Coast', 'Sydney Northern Beaches',
  'Uluwatu', 'Hossegor', "Jeffrey's Bay",
]

const RATING_PILL: Record<string, { bg: string; text: string; track: string }> = {
  epic:  { bg: '#7c3aed', text: 'white', track: '#ddd6fe' },
  great: { bg: '#1b7fcb', text: 'white', track: '#bfdbfe' },
  good:  { bg: '#059669', text: 'white', track: '#a7f3d0' },
  fair:  { bg: '#d97706', text: 'white', track: '#fde68a' },
  poor:  { bg: '#6b7280', text: 'white', track: '#e5e7eb' },
  flat:  { bg: '#e5e7eb', text: '#374151', track: '#f3f4f6' },
}

// Static skeleton heights — same on server and client (no hydration risk)
const SKELETON = [28,38,48,42,32,28,52,62,68,72,66,58,54,64,72,68,58,50,44,40,36,30,26,22]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLocalDateStr(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function hourFromTime(time: string): number {
  return parseInt(time.slice(11, 13), 10)
}

function dayLabel(dateStr: string, i: number): string {
  if (i === 0) return 'Today'
  if (i === 1) return 'Tomorrow'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function hrLabel(h: number): string {
  if (h === 0)  return '12 AM'
  if (h < 12)   return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function scoreColor(s: number) {
  if (s >= 75) return '#7c3aed'
  if (s >= 55) return '#1b7fcb'
  if (s >= 35) return '#059669'
  if (s >= 20) return '#d97706'
  return '#94a3b8'
}

function scoreLabel(s: number) {
  if (s >= 75) return 'Epic'
  if (s >= 55) return 'Great'
  if (s >= 35) return 'Good'
  if (s >= 20) return 'Fair'
  return 'Poor'
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpotHour {
  time: string; rating: string; ratingScore: number
  waveHeight: number; windSpeed: number; windDirectionLabel: string
}
interface Spot {
  id: string; name: string; slug: string
  facingDirection: number; hours: SpotHour[]
}
interface SwellHour {
  time: string; waveHeight: number; swellPeriod: number
  swellDirectionLabel: string; windSpeed: number; windDirectionLabel: string
}

// ── SVG bar chart ─────────────────────────────────────────────────────────────

const SVG_W = 480   // viewBox width  (24 bars × 20)
const SVG_H = 88    // viewBox height
const BAR_W = 18    // bar width (1px gap between bars)

function BarChart({ scores, selectedHour, nowHour, isLoading, onSelect }: {
  scores: number[]
  selectedHour: number
  nowHour: number | null
  isLoading: boolean
  onSelect: (h: number) => void
}) {
  const maxScore = Math.max(...scores, 1)

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height={SVG_H}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {Array.from({ length: 24 }, (_, h) => {
        const score  = scores[h] ?? 0
        const barH   = isLoading
          ? (SKELETON[h] / 100) * (SVG_H - 4)
          : Math.max(4, (score / maxScore) * (SVG_H - 4))
        const x      = h * 20
        const y      = SVG_H - barH
        const fill   = isLoading ? '#e2e8f0' : scoreColor(score)
        const active = h === selectedHour

        return (
          <g
            key={h}
            onClick={() => onSelect(h)}
            style={{ cursor: 'pointer' }}
          >
            {/* Invisible full-height hit area */}
            <rect x={x} y={0} width={20} height={SVG_H} fill="transparent" />
            {/* Visible bar */}
            <rect
              x={x + 1} y={y} width={BAR_W} height={barH} rx={2}
              fill={active ? fill : fill + 'aa'}
            />
            {/* Selection indicator — white outline */}
            {active && (
              <rect
                x={x} y={y - 2} width={20} height={barH + 2} rx={3}
                fill="none" stroke={fill} strokeWidth={1.5}
              />
            )}
            {/* Now dot */}
            {h === nowHour && (
              <circle cx={x + 10} cy={3} r={2.5} fill="#f97316" />
            )}
          </g>
        )
      })}

      {/* Hour axis labels */}
      {[0, 6, 12, 18, 23].map((h) => (
        <text
          key={h}
          x={h * 20 + 10}
          y={SVG_H + 14}
          textAnchor="middle"
          fontSize={9}
          fill="#94a3b8"
        >
          {hrLabel(h)}
        </text>
      ))}

      {/* Pulsing overlay when loading */}
      {isLoading && (
        <rect
          x={0} y={0} width={SVG_W} height={SVG_H}
          fill="white" opacity={0.5}
          style={{ animation: 'tlPulse 1.4s ease-in-out infinite' }}
        />
      )}

      <style>{`
        @keyframes tlPulse {
          0%,100% { opacity: 0.5; }
          50%      { opacity: 0.1; }
        }
      `}</style>
    </svg>
  )
}

// ── Spot row ──────────────────────────────────────────────────────────────────

function SpotRow({ spot, rank, hour }: { spot: Spot; rank: number; hour: number }) {
  const hd = spot.hours.find((h) => hourFromTime(h.time) === hour) ?? spot.hours[0]
  if (!hd) return null
  const rc = RATING_PILL[hd.rating] ?? RATING_PILL.poor

  return (
    <Link
      href={`/spots/${spot.slug}`}
      className="group flex items-center gap-4 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: 'white', border: '1px solid var(--border)', textDecoration: 'none' }}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ background: rank <= 3 ? 'var(--ocean-600)' : 'var(--sand-100)', color: rank <= 3 ? 'white' : 'var(--text-3)' }}
      >
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
          {spot.name}
        </div>
        <div className="text-xs mt-0.5 flex gap-2" style={{ color: 'var(--text-3)' }}>
          <span>{hd.waveHeight.toFixed(1)} m</span>
          <span>·</span>
          <span>{hd.windDirectionLabel} {Math.round(hd.windSpeed)} km/h wind</span>
        </div>
      </div>

      <div className="hidden sm:flex flex-col gap-1 w-28">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: rc.track }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, hd.ratingScore)}%`, background: rc.bg }} />
        </div>
        <div className="text-xs" style={{ color: 'var(--text-3)' }}>{Math.round(hd.ratingScore)}/100</div>
      </div>

      <div className="flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
        style={{ background: rc.bg, color: rc.text }}>
        {scoreLabel(hd.ratingScore)}
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
  // Stable initial values to avoid SSR/client hydration mismatch.
  // useEffect sets real current hour after mount.
  const [hour,    setHour]    = useState(10)
  const [nowHour, setNowHour] = useState<number | null>(null)
  const [region,  setRegion]  = useState('San Diego')
  const [dayIdx,  setDayIdx]  = useState(0)

  useEffect(() => {
    const h = new Date().getHours()
    setHour(h)
    setNowHour(h)
  }, [])

  useEffect(() => {
    setNowHour(dayIdx === 0 ? new Date().getHours() : null)
  }, [dayIdx])

  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => getLocalDateStr(i)), [])
  const selectedDate = dates[dayIdx]

  const { data, isLoading, isError } = useQuery({
    queryKey: ['timeline', region, selectedDate],
    queryFn: () =>
      fetch(`/api/best-spots?region=${encodeURIComponent(region)}&date=${selectedDate}`)
        .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() }),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })

  const spots: Spot[]      = data?.spots        ?? []
  const swell: SwellHour[] = data?.regionalSwell ?? []

  const hourlyScores = useMemo((): number[] => {
    if (!spots.length) return Array(24).fill(0) as number[]
    return Array.from({ length: 24 }, (_, h) => {
      const vals = spots.map(
        (s) => s.hours.find((e) => hourFromTime(e.time) === h)?.ratingScore ?? 0
      )
      return vals.reduce((a, b) => a + b, 0) / vals.length
    })
  }, [spots])

  const swellNow   = swell.find((s) => hourFromTime(s.time) === hour) ?? swell[0]
  const avgScore   = hourlyScores[hour] ?? 0
  const bestHour   = hourlyScores.reduce((best, v, i) => v > hourlyScores[best] ? i : best, 0)

  const rankedSpots = useMemo(() =>
    [...spots].sort((a, b) => {
      const aS = a.hours.find((h) => hourFromTime(h.time) === hour)?.ratingScore ?? 0
      const bS = b.hours.find((h) => hourFromTime(h.time) === hour)?.ratingScore ?? 0
      return bS - aS
    }), [spots, hour])

  return (
    <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>

      {/* Header */}
      <div className="border-b" style={{ background: 'white', borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-5xl px-5 py-7">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--ocean-500)' }}>
            Surf Forecast
          </p>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            Timeline
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
            Click a bar or drag the slider to explore conditions hour-by-hour.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-7 space-y-6">

        {/* Controls */}
        <div className="flex flex-wrap gap-5 items-end">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
              Region
            </label>
            <div className="relative">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
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

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
              Day
            </label>
            <div className="flex gap-2 flex-wrap">
              {dates.map((ds, i) => (
                <button key={ds} onClick={() => setDayIdx(i)}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold transition-all"
                  style={{
                    background: dayIdx === i ? 'var(--ocean-600)' : 'white',
                    color:      dayIdx === i ? 'white' : 'var(--text-2)',
                    border:     `1px solid ${dayIdx === i ? 'var(--ocean-600)' : 'var(--border)'}`,
                  }}>
                  {dayLabel(ds, i)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart card */}
        <div className="rounded-2xl p-6 space-y-4" style={{ background: 'white', border: '1px solid var(--border)' }}>

          {/* Time label + swell info */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--ocean-700)' }}>
                  {hrLabel(hour)}
                </span>
                {!isLoading && !isError && avgScore > 0 && (
                  <span className="rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{ background: scoreColor(avgScore), color: 'white' }}>
                    {scoreLabel(avgScore)}
                  </span>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {!isLoading && !isError && spots.length > 0 && (
                  <> · Peak: <span style={{ color: 'var(--ocean-600)', fontWeight: 600 }}>{hrLabel(bestHour)}</span></>
                )}
              </p>
            </div>

            {!isLoading && !isError && swellNow && (
              <div className="flex gap-5 flex-wrap">
                {[
                  { label: 'Waves',  val: `${swellNow.waveHeight.toFixed(1)} m` },
                  { label: 'Period', val: `${swellNow.swellPeriod.toFixed(0)} s` },
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

          {/* SVG bar chart — always visible, click to select hour */}
          <div className="pb-5">
            <BarChart
              scores={hourlyScores}
              selectedHour={hour}
              nowHour={nowHour}
              isLoading={isLoading}
              onSelect={setHour}
            />
          </div>

          {/* Range slider — always interactive */}
          <div className="px-1">
            <input
              type="range"
              min={0} max={23} step={1}
              value={hour}
              onChange={(e) => setHour(parseInt(e.target.value, 10))}
              className="w-full"
              style={{ accentColor: !isLoading && avgScore > 0 ? scoreColor(avgScore) : 'var(--ocean-600)', cursor: 'pointer' }}
            />
          </div>

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

        {/* Ranked spots */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              Best Spots at {hrLabel(hour)}
            </h2>
            {!isLoading && rankedSpots.length > 0 && (
              <span className="text-sm" style={{ color: 'var(--text-3)' }}>
                {rankedSpots.length} spots · {region}
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
            <div className="rounded-2xl p-5 text-sm"
              style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
              Could not load forecast. Open-Meteo may be temporarily unavailable — try again shortly.
            </div>
          )}

          {!isLoading && !isError && rankedSpots.length === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'white', border: '1px solid var(--border)' }}>
              <div className="text-3xl mb-3">🌊</div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>No spots found for {region}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Try San Diego, Los Angeles, or another California region.</p>
            </div>
          )}

          {!isLoading && !isError && rankedSpots.length > 0 && (
            <div className="space-y-3">
              {rankedSpots.map((spot, idx) => (
                <SpotRow key={spot.id} spot={spot} rank={idx + 1} hour={hour} />
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 text-center">
          <Link href="/spots"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: 'var(--ocean-600)' }}>
            🗺️ Open live map
          </Link>
        </div>
      </div>
    </div>
  )
}
