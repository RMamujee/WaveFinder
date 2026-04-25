'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtHeight, fmtWind, fmtTemp } from '@/lib/units'
import { Icon } from '@/components/ui/Icon'

// ── Region config ─────────────────────────────────────────────────────────────

const REGIONS = [
  { name: 'San Diego',             icon: <Icon name="wave" size={22} />,   short: 'San Diego'   },
  { name: 'Orange County',         icon: '🌴',                                short: 'O.C.'        },
  { name: 'Los Angeles',           icon: '🌆',                                short: 'L.A.'        },
  { name: 'Ventura',               icon: <Icon name="surfer" size={22} />,   short: 'Ventura'     },
  { name: 'Santa Barbara',         icon: '🌸', short: 'S.B.'        },
  { name: 'Central Coast',         icon: '🌾', short: 'Cen. Coast'  },
  { name: 'Monterey',              icon: '🦭', short: 'Monterey'    },
  { name: 'NorCal',                icon: '🌉', short: 'NorCal'      },
  { name: 'North Shore',           icon: '🌺', short: 'N. Shore'    },
  { name: 'South Shore',           icon: '🤙', short: 'S. Shore'    },
  { name: 'Gold Coast',            icon: '🦘', short: 'Gold Coast'  },
  { name: 'Sydney Northern Beaches', icon: '🏖️', short: 'Sydney'   },
  { name: 'Uluwatu',               icon: '🌿', short: 'Uluwatu'     },
  { name: 'Hossegor',              icon: '🥖', short: 'Hossegor'    },
  { name: "Jeffrey's Bay",         icon: '🦁', short: "J-Bay"       },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Sunrise / sunset calculator (simple astronomical formula) ─────────────────

function sunTimes(dateStr: string): { rise: number; set: number } {
  const lat = 34.0 // default midpoint latitude (California / global avg)
  const date = new Date(dateStr + 'T12:00:00')
  const doy = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
  const B = (360 / 365) * (doy - 81) * (Math.PI / 180)
  const eqTime = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
  const decl = 23.45 * Math.sin(B) * (Math.PI / 180)
  const latRad = lat * (Math.PI / 180)
  const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(decl)) * (180 / Math.PI)
  const noon = 12 - eqTime / 60
  return {
    rise: noon - hourAngle / 15,
    set: noon + hourAngle / 15,
  }
}

// ── Sunrise/sunset bar component ──────────────────────────────────────────────

function SunriseSunsetBar({ dateStr, hour }: { dateStr: string; hour: number }) {
  if (!dateStr) return null
  const { rise, set } = sunTimes(dateStr)

  const risePct = (rise / 23) * 100
  const setPct = (set / 23) * 100
  const nowPct = (hour / 23) * 100

  const isDaytime = hour >= rise && hour <= set
  const isGoldenHour = (hour >= rise && hour <= rise + 1) || (hour >= set - 1 && hour <= set)

  return (
    <div style={{ marginTop: '8px' }}>
      {/* Day/night gradient bar */}
      <div style={{ position: 'relative', height: '28px', borderRadius: '14px', overflow: 'hidden', background: '#0f172a' }}>
        {/* Night → dawn gradient */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${risePct}%`,
          background: 'linear-gradient(to right, #0f172a 0%, #1e3a5f 70%, #f97316 100%)',
        }} />
        {/* Day (full daylight) */}
        <div style={{
          position: 'absolute', left: `${risePct}%`, top: 0, bottom: 0,
          width: `${setPct - risePct}%`,
          background: 'linear-gradient(to right, #f97316 0%, #fbbf24 8%, #87ceeb 20%, #60a5fa 40%, #60a5fa 60%, #87ceeb 80%, #fbbf24 92%, #f97316 100%)',
        }} />
        {/* Dusk → night gradient */}
        <div style={{
          position: 'absolute', left: `${setPct}%`, top: 0, bottom: 0, right: 0,
          background: 'linear-gradient(to right, #f97316 0%, #1e3a5f 30%, #0f172a 100%)',
        }} />

        {/* Sunrise icon */}
        <div style={{
          position: 'absolute', left: `${risePct}%`, top: '50%', transform: 'translate(-50%, -50%)',
          color: '#fbbf24', display: 'flex', alignItems: 'center',
        }}>
          <Icon name="sun" size={14} strokeWidth={2} />
        </div>

        {/* Sunset icon */}
        <div style={{
          position: 'absolute', left: `${setPct}%`, top: '50%', transform: 'translate(-50%, -50%)',
          color: '#fb923c', display: 'flex', alignItems: 'center',
        }}>
          <Icon name="moon" size={12} strokeWidth={2} />
        </div>

        {/* Current hour marker */}
        <div style={{
          position: 'absolute', left: `${nowPct}%`, top: 0, bottom: 0,
          width: '2px',
          background: 'white',
          transform: 'translateX(-50%)',
          opacity: 0.9,
          boxShadow: '0 0 4px rgba(255,255,255,0.8)',
        }} />
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>
          Sunrise {Math.floor(rise)}:{String(Math.round((rise % 1) * 60)).padStart(2, '0')}
        </span>
        <span style={{ fontSize: '10px', fontWeight: 600, color: isDaytime ? (isGoldenHour ? '#f97316' : '#1b7fcb') : '#6b7280' }}>
          {isDaytime ? (isGoldenHour ? <><Icon name="sun" size={11} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle' }} /> Golden hour</> : <><Icon name="sun" size={11} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle' }} /> Daytime</>) : <><Icon name="moon" size={11} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle' }} /> Night</>}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>
          Sunset {Math.floor(set)}:{String(Math.round((set % 1) * 60)).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
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


// ── Types ─────────────────────────────────────────────────────────────────────

interface SpotHour {
  time: string; rating: string; ratingScore: number
  waveHeight: number; windSpeed: number; windDirectionLabel: string
}
interface Spot { id: string; name: string; slug: string; hours: SpotHour[] }
interface SwellHour {
  time: string; seaSurfaceTemperature: number | null
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { unit } = useUnits()
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
    enabled: !!selectedDate,
    staleTime: 30 * 60 * 1000,
  })

  const spots: Spot[]      = data?.spots        ?? []
  const swell: SwellHour[] = data?.regionalSwell ?? []

  const swellNow = swell.find(s => hrFromTime(s.time) === hour) ?? swell[0]
  const waterTemp = swellNow?.seaSurfaceTemperature ?? null

  const sorted = useMemo(() =>
    [...spots]
      .map(s => ({ spot: s, hd: s.hours.find(e => hrFromTime(e.time) === hour) ?? s.hours[0] }))
      .filter(x => !!x.hd)
      .sort((a, b) => (b.hd?.ratingScore ?? 0) - (a.hd?.ratingScore ?? 0)),
    [spots, hour]
  )

  const topScore  = sorted[0]?.hd?.ratingScore ?? 0
  const trackColor = !isLoading && topScore > 0 ? scoreColor(topScore) : 'var(--ocean-600)'
  const pct        = (hour / 23) * 100

  if (!mounted) {
    return (
      <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>
        <div className="border-b" style={{ background: 'white', borderColor: 'var(--border)' }}>
          <div className="mx-auto max-w-4xl px-5 py-8">
            <div className="h-4 w-24 rounded mb-3 animate-pulse" style={{ background: 'var(--sand-200)' }} />
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
            Pick a region, drag the bar to any hour, see ranked spots.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5 py-8 space-y-6">

        {/* ── Region icon picker ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
            Region
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))' }}>
            {REGIONS.map(r => {
              const active = region === r.name
              return (
                <button
                  key={r.name}
                  onClick={() => setRegion(r.name)}
                  className="flex flex-col items-center gap-1 rounded-2xl py-3 px-1 transition-all"
                  style={{
                    background:  active ? 'var(--ocean-600)' : 'white',
                    border:      `1px solid ${active ? 'var(--ocean-600)' : 'var(--border)'}`,
                    boxShadow:   active ? '0 2px 10px rgba(27,127,203,0.25)' : 'none',
                    transform:   active ? 'translateY(-1px)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '22px', lineHeight: 1 }}>{r.icon}</span>
                  <span
                    className="text-center font-semibold leading-tight"
                    style={{
                      fontSize: '10px',
                      color: active ? 'white' : 'var(--text-2)',
                      maxWidth: '68px',
                      wordBreak: 'break-word',
                    }}
                  >
                    {r.short}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Day picker ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>
            Day
          </p>
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

        {/* ── Slider card ── */}
        <div className="rounded-2xl p-6 space-y-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-4xl font-bold"
                style={{ fontFamily: 'Playfair Display, serif', color: 'var(--ocean-700)', letterSpacing: '-0.02em' }}>
                {hrLabel(hour)}
              </div>
              <div className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
                {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {waterTemp !== null && (
                <div className="rounded-xl px-3 py-2 text-sm font-semibold"
                  style={{ background: 'var(--ocean-50)', color: 'var(--ocean-700)', border: '1px solid var(--ocean-100)' }}>
                  💧 {fmtTemp(waterTemp, unit)} water
                </div>
              )}
              {!isLoading && !isError && topScore > 0 && (
                <div className="rounded-xl px-3 py-2 text-sm font-bold"
                  style={{ background: trackColor, color: 'white' }}>
                  {scoreLabel(topScore)}
                </div>
              )}
            </div>
          </div>

          {/* Styled range slider */}
          <style>{`
            .tl-slider {
              -webkit-appearance: none; appearance: none;
              width: 100%; height: 10px; border-radius: 9999px;
              outline: none; cursor: pointer;
              background: linear-gradient(to right,
                ${trackColor} 0%, ${trackColor} ${pct}%,
                #e2e8f0 ${pct}%, #e2e8f0 100%);
            }
            .tl-slider::-webkit-slider-thumb {
              -webkit-appearance: none; appearance: none;
              width: 28px; height: 28px; border-radius: 9999px;
              background: white; border: 3px solid ${trackColor};
              box-shadow: 0 2px 8px rgba(0,0,0,0.18); cursor: pointer;
              transition: transform 0.1s;
            }
            .tl-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
            .tl-slider::-moz-range-thumb {
              width: 28px; height: 28px; border-radius: 9999px;
              background: white; border: 3px solid ${trackColor};
              box-shadow: 0 2px 8px rgba(0,0,0,0.18); cursor: pointer;
            }
          `}</style>
          <div className="space-y-2">
            <input type="range" min={0} max={23} step={1}
              value={hour} onChange={e => setHour(parseInt(e.target.value, 10))}
              className="tl-slider" />
            <div className="flex justify-between text-xs px-0.5" style={{ color: 'var(--text-3)' }}>
              <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
            </div>
          </div>
          <SunriseSunsetBar dateStr={selectedDate} hour={hour} />
        </div>

        {/* ── Spot rows ── */}
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
            <div className="rounded-2xl p-5 space-y-1"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-sm font-semibold" style={{ color: '#b91c1c' }}>Could not load forecast</p>
              <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{(error as Error)?.message}</p>
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

                    {/* Rank */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: idx < 3 ? 'var(--ocean-600)' : 'var(--sand-100)', color: idx < 3 ? 'white' : 'var(--text-3)' }}>
                      {idx + 1}
                    </div>

                    {/* Name + stats */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate"
                        style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
                        {spot.name}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {/* Wave height */}
                        <span className="flex items-center gap-1 text-xs font-medium"
                          style={{ color: 'var(--ocean-600)' }}>
                          <Icon name="wave" size={12} strokeWidth={2} />
                          {fmtHeight(hd!.waveHeight, unit)}
                        </span>
                        {/* Wind */}
                        <span className="flex items-center gap-1 text-xs font-medium"
                          style={{ color: 'var(--text-2)' }}>
                          <Icon name="wind" size={12} strokeWidth={2} />
                          {hd!.windDirectionLabel} {fmtWind(hd!.windSpeed, unit)}
                        </span>
                        {/* Water temp */}
                        {waterTemp !== null && (
                          <span className="flex items-center gap-1 text-xs font-medium"
                            style={{ color: '#0891b2' }}>
                            <Icon name="temp" size={12} strokeWidth={2} />
                            {fmtTemp(waterTemp, unit)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="hidden sm:flex flex-col gap-1 w-24">
                      <div className="h-1.5 rounded-full" style={{ background: '#e5e7eb' }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${Math.min(100, hd!.ratingScore)}%`, background: color }} />
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {Math.round(hd!.ratingScore)}/100
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
                      style={{ background: color, color: 'white' }}>
                      {scoreLabel(hd!.ratingScore)}
                    </div>

                    <Icon name="arrowRight" size={14} strokeWidth={2}
                      className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--text-3)' }} />
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
            <Icon name="map" size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Open live map
          </Link>
        </div>
      </div>
    </div>
  )
}
