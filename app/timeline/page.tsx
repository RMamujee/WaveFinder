'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

const REGIONS = [
  'San Diego', 'Orange County', 'Los Angeles', 'Ventura',
  'Santa Barbara', 'Central Coast', 'Monterey', 'NorCal',
  'North Shore', 'South Shore', 'Gold Coast', 'Sydney Northern Beaches',
  'Uluwatu', 'Hossegor', "Jeffrey's Bay",
]

function getLocalDateStr(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

function hrFromTime(t: string): number {
  return parseInt(t.slice(11, 13), 10)
}

function hrLabel(h: number): string {
  if (h === 0)  return '12:00 AM'
  if (h < 12)   return `${h}:00 AM`
  if (h === 12) return '12:00 PM'
  return `${h - 12}:00 PM`
}

function dayLabel(ds: string, i: number): string {
  if (i === 0) return 'Today'
  if (i === 1) return 'Tomorrow'
  return new Date(ds + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function scoreColor(s: number) {
  if (s >= 75) return '#7c3aed'
  if (s >= 55) return '#1b7fcb'
  if (s >= 35) return '#059669'
  if (s >= 20) return '#d97706'
  return '#6b7280'
}

function scoreLabel(s: number) {
  if (s >= 75) return 'Epic'
  if (s >= 55) return 'Great'
  if (s >= 35) return 'Good'
  if (s >= 20) return 'Fair'
  return 'Poor'
}

function mToFt(m: number) {
  return (m * 3.281).toFixed(1) + ' ft'
}

interface SpotHour {
  time: string; rating: string; ratingScore: number
  waveHeight: number; windSpeed: number; windDirectionLabel: string
}
interface Spot { id: string; name: string; slug: string; hours: SpotHour[] }

export default function TimelinePage() {
  // All dynamic state initialized after mount to guarantee no SSR/client mismatch
  const [mounted,  setMounted]  = useState(false)
  const [hour,     setHour]     = useState(10)
  const [region,   setRegion]   = useState('Los Angeles')
  const [dayIdx,   setDayIdx]   = useState(0)
  const [dates,    setDates]    = useState<string[]>([])

  useEffect(() => {
    const h = new Date().getHours()
    setHour(Math.max(6, Math.min(21, h)))
    setDates(Array.from({ length: 7 }, (_, i) => getLocalDateStr(i)))
    setMounted(true)
  }, [])

  const selectedDate = dates[dayIdx] ?? ''

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['best-spots', region, selectedDate],
    queryFn: () =>
      fetch(`/api/best-spots?region=${encodeURIComponent(region)}&date=${selectedDate}`)
        .then(async r => {
          if (!r.ok) {
            const msg = await r.text().catch(() => r.statusText)
            throw new Error(`${r.status} – ${msg}`)
          }
          return r.json()
        }),
    enabled: !!selectedDate,   // don't fire until date is set client-side
    staleTime: 30 * 60 * 1000,
  })

  const spots: Spot[] = data?.spots ?? []

  const sorted = useMemo(() =>
    [...spots]
      .map(s => ({ spot: s, hd: s.hours.find(e => hrFromTime(e.time) === hour) ?? s.hours[0] }))
      .filter(x => !!x.hd)
      .sort((a, b) => (b.hd?.ratingScore ?? 0) - (a.hd?.ratingScore ?? 0)),
    [spots, hour]
  )

  const trackColor = !isLoading && sorted.length > 0
    ? scoreColor(sorted[0]?.hd?.ratingScore ?? 0)
    : 'var(--ocean-600)'

  const pct = (hour / 23) * 100

  // Skeleton while not yet mounted (avoids any flash)
  if (!mounted) {
    return (
      <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>
        <div className="border-b" style={{ background: 'white', borderColor: 'var(--border)' }}>
          <div className="mx-auto max-w-4xl px-5 py-8">
            <div className="h-4 w-24 rounded-lg mb-3 animate-pulse" style={{ background: 'var(--sand-200)' }} />
            <div className="h-9 w-40 rounded-xl animate-pulse" style={{ background: 'var(--sand-200)' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>

      {/* Header */}
      <div className="border-b" style={{ background: 'white', borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-4xl px-5 py-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--ocean-500)' }}>
            Interactive
          </p>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            Timeline
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
            Drag the bar to find the best surf time of day.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5 py-8 space-y-6">

        {/* Region + Day controls */}
        <div className="flex flex-wrap gap-5 items-end">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
              Region
            </label>
            <div className="relative">
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="rounded-xl border px-4 py-2.5 text-sm font-medium appearance-none pr-9 cursor-pointer"
                style={{ background: 'white', borderColor: 'var(--border)', color: 'var(--text)', minWidth: '170px' }}
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
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

        {/* Slider card */}
        <div className="rounded-2xl p-6 space-y-6" style={{ background: 'white', border: '1px solid var(--border)' }}>

          {/* Time display */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-4xl font-bold tabular-nums"
                style={{ fontFamily: 'Playfair Display, serif', color: 'var(--ocean-700)', letterSpacing: '-0.02em' }}>
                {hrLabel(hour)}
              </div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                {selectedDate
                  ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric',
                    })
                  : ''}
              </div>
            </div>
            {!isLoading && !isError && sorted.length > 0 && (
              <div className="rounded-2xl px-4 py-2 text-sm font-bold"
                style={{ background: trackColor, color: 'white' }}>
                {scoreLabel(sorted[0]?.hd?.ratingScore ?? 0)} conditions
              </div>
            )}
          </div>

          {/* Custom styled slider */}
          <div className="space-y-3">
            <style>{`
              .timeline-slider {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 10px;
                border-radius: 9999px;
                outline: none;
                cursor: pointer;
                background: linear-gradient(
                  to right,
                  ${trackColor} 0%,
                  ${trackColor} ${pct}%,
                  #e2e8f0 ${pct}%,
                  #e2e8f0 100%
                );
                transition: background 0.1s;
              }
              .timeline-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 28px;
                height: 28px;
                border-radius: 9999px;
                background: white;
                border: 3px solid ${trackColor};
                box-shadow: 0 2px 8px rgba(0,0,0,0.18);
                cursor: pointer;
                transition: border-color 0.1s, transform 0.1s;
              }
              .timeline-slider::-webkit-slider-thumb:hover {
                transform: scale(1.15);
              }
              .timeline-slider::-moz-range-thumb {
                width: 28px;
                height: 28px;
                border-radius: 9999px;
                background: white;
                border: 3px solid ${trackColor};
                box-shadow: 0 2px 8px rgba(0,0,0,0.18);
                cursor: pointer;
              }
              .timeline-slider::-moz-range-track {
                height: 10px;
                border-radius: 9999px;
                background: #e2e8f0;
              }
            `}</style>
            <input
              type="range"
              min={0} max={23} step={1}
              value={hour}
              onChange={e => setHour(parseInt(e.target.value, 10))}
              className="timeline-slider"
            />
            <div className="flex justify-between text-xs px-1" style={{ color: 'var(--text-3)' }}>
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>11 PM</span>
            </div>
          </div>
        </div>

        {/* Spots list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              Best at {hrLabel(hour)}
            </h2>
            {!isLoading && !isError && sorted.length > 0 && (
              <span className="text-sm" style={{ color: 'var(--text-3)' }}>
                {sorted.length} spots · {region}
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
            <div className="rounded-2xl p-5 space-y-2"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-sm font-semibold" style={{ color: '#b91c1c' }}>
                Could not load forecast
              </p>
              <p className="text-xs font-mono" style={{ color: '#ef4444' }}>
                {(error as Error)?.message ?? 'Unknown error'}
              </p>
              <p className="text-xs" style={{ color: '#b91c1c' }}>
                Try a different region, or check that the Vercel environment variables (DATABASE_URL) are set in your project settings.
              </p>
            </div>
          )}

          {!isLoading && !isError && sorted.length === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'white', border: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text-2)' }}>No spots found for {region}.</p>
            </div>
          )}

          {!isLoading && !isError && sorted.length > 0 && (
            <div className="space-y-3">
              {sorted.map(({ spot, hd }, idx) => {
                const color = scoreColor(hd!.ratingScore)
                return (
                  <Link key={spot.id} href={`/spots/${spot.slug}`}
                    className="group flex items-center gap-4 rounded-2xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
                    style={{ background: 'white', border: '1px solid var(--border)', textDecoration: 'none' }}>

                    <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: idx < 3 ? 'var(--ocean-600)' : 'var(--sand-100)', color: idx < 3 ? 'white' : 'var(--text-3)' }}>
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate"
                        style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
                        {spot.name}
                      </div>
                      <div className="text-xs mt-0.5 flex gap-2" style={{ color: 'var(--text-3)' }}>
                        <span>{mToFt(hd!.waveHeight)}</span>
                        <span>·</span>
                        <span>{hd!.windDirectionLabel} {Math.round(hd!.windSpeed)} km/h</span>
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col gap-1 w-28">
                      <div className="h-1.5 rounded-full" style={{ background: '#e5e7eb' }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${Math.min(100, hd!.ratingScore)}%`, background: color }} />
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {Math.round(hd!.ratingScore)}/100
                      </div>
                    </div>

                    <div className="flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
                      style={{ background: color, color: 'white' }}>
                      {scoreLabel(hd!.ratingScore)}
                    </div>

                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--text-3)' }}>
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
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
