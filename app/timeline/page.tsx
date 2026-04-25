'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtHeight, fmtWind, fmtTemp } from '@/lib/units'
import { Icon } from '@/components/ui/Icon'

// ── Region config ─────────────────────────────────────────────────────────────

interface Region {
  name: string
  short: string
  icon: React.ReactNode
  lat: number
}

const REGIONS: Region[] = [
  // ── California ───────────────────────────────────────────────────────────────
  { name: 'San Diego',               short: 'San Diego',    icon: <Icon name="wave" size={22} />,   lat: 32.7  },
  { name: 'Orange County',           short: 'O.C.',         icon: '🌴',                              lat: 33.6  },
  { name: 'Los Angeles',             short: 'L.A.',         icon: '🌆',                              lat: 34.0  },
  { name: 'Ventura',                 short: 'Ventura',      icon: <Icon name="surfer" size={22} />,  lat: 34.3  },
  { name: 'Santa Barbara',           short: 'S.B.',         icon: '🌸',                              lat: 34.4  },
  { name: 'Central Coast',           short: 'Cen. Coast',   icon: '🌾',                              lat: 35.4  },
  { name: 'Monterey',                short: 'Monterey',     icon: '🦭',                              lat: 36.6  },
  { name: 'NorCal',                  short: 'NorCal',       icon: '🌉',                              lat: 37.8  },
  // ── Pacific Northwest ────────────────────────────────────────────────────────
  { name: 'Oregon',                  short: 'Oregon',       icon: '🌲',                              lat: 44.6  },
  { name: 'Washington',              short: 'Washington',   icon: '🏔️',                             lat: 47.8  },
  // ── East Coast USA ───────────────────────────────────────────────────────────
  { name: 'New York',                short: 'New York',     icon: '🗽',                              lat: 40.7  },
  { name: 'Cape Hatteras',           short: 'Hatteras',     icon: '🦅',                              lat: 35.2  },
  { name: 'Florida',                 short: 'Florida',      icon: '🐊',                              lat: 28.4  },
  // ── Hawaii ───────────────────────────────────────────────────────────────────
  { name: 'North Shore',             short: 'N. Shore',     icon: '🌺',                              lat: 21.6  },
  { name: 'South Shore',             short: 'S. Shore',     icon: '🤙',                              lat: 21.3  },
  { name: 'Maui',                    short: 'Maui',         icon: '🐋',                              lat: 20.8  },
  // ── Mexico ───────────────────────────────────────────────────────────────────
  { name: 'Baja Norte',              short: 'Baja Norte',   icon: '🌵',                              lat: 30.0  },
  { name: 'Puerto Escondido',        short: 'P. Esc.',      icon: '🌴',                              lat: 15.9  },
  // ── South America ────────────────────────────────────────────────────────────
  { name: 'Chicama',                 short: 'Chicama',      icon: '🦙',                              lat: -8.0  },
  { name: 'Pichilemu',               short: 'Pichilemu',    icon: '🐧',                              lat: -34.4 },
  // ── Europe ───────────────────────────────────────────────────────────────────
  { name: 'Hossegor',                short: 'Hossegor',     icon: '🥖',                              lat: 43.7  },
  { name: 'Nazaré',                  short: 'Nazaré',       icon: '🏰',                              lat: 39.6  },
  { name: 'Ericeira',                short: 'Ericeira',     icon: '🌿',                              lat: 38.9  },
  { name: 'Mundaka',                 short: 'Mundaka',      icon: '⚓',                              lat: 43.4  },
  { name: 'Canary Islands',          short: 'Canaries',     icon: '🌋',                              lat: 28.1  },
  { name: 'Bundoran',                short: 'Bundoran',     icon: '🍀',                              lat: 54.5  },
  { name: 'Thurso',                  short: 'Thurso',       icon: '⛰️',                             lat: 58.6  },
  // ── Africa ───────────────────────────────────────────────────────────────────
  { name: 'Taghazout',               short: 'Taghazout',    icon: '🏜️',                             lat: 30.5  },
  { name: "Jeffrey's Bay",           short: "J-Bay",        icon: '🦁',                              lat: -34.1 },
  { name: 'Cape Town',               short: 'Cape Town',    icon: '🐧',                              lat: -34.0 },
  // ── Australia ────────────────────────────────────────────────────────────────
  { name: 'Gold Coast',              short: 'Gold Coast',   icon: '🦘',                              lat: -28.0 },
  { name: 'Sydney Northern Beaches', short: 'Sydney',       icon: '🏖️',                             lat: -33.8 },
  { name: 'Margaret River',          short: 'Marg. River',  icon: '🍷',                              lat: -33.9 },
  { name: 'Victoria',                short: 'Victoria',     icon: '🐨',                              lat: -38.6 },
  // ── Indonesia ────────────────────────────────────────────────────────────────
  { name: 'Uluwatu',                 short: 'Uluwatu',      icon: '🌿',                              lat: -8.8  },
  { name: 'G-Land',                  short: 'G-Land',       icon: '🌴',                              lat: -8.4  },
  { name: 'Mentawai',                short: 'Mentawai',     icon: '🐬',                              lat: -1.5  },
  // ── Pacific Islands ──────────────────────────────────────────────────────────
  { name: 'Tahiti',                  short: 'Tahiti',       icon: '🌺',                              lat: -17.9 },
  { name: 'Fiji',                    short: 'Fiji',         icon: '🐠',                              lat: -18.1 },
  { name: 'Maldives',                short: 'Maldives',     icon: '🏝️',                             lat: 4.2   },
  // ── Asia ─────────────────────────────────────────────────────────────────────
  { name: 'Siargao',                 short: 'Siargao',      icon: '🥥',                              lat: 9.8   },
  { name: 'Chiba',                   short: 'Chiba',        icon: '🗻',                              lat: 35.6  },
]

const REGION_GROUPS: { label: string; names: string[] }[] = [
  { label: 'California',        names: ['San Diego', 'Orange County', 'Los Angeles', 'Ventura', 'Santa Barbara', 'Central Coast', 'Monterey', 'NorCal'] },
  { label: 'Pacific Northwest', names: ['Oregon', 'Washington'] },
  { label: 'East Coast',        names: ['New York', 'Cape Hatteras', 'Florida'] },
  { label: 'Hawaii',            names: ['North Shore', 'South Shore', 'Maui'] },
  { label: 'Mexico',            names: ['Baja Norte', 'Puerto Escondido'] },
  { label: 'South America',     names: ['Chicama', 'Pichilemu'] },
  { label: 'Europe',            names: ['Hossegor', 'Nazaré', 'Ericeira', 'Mundaka', 'Canary Islands', 'Bundoran', 'Thurso'] },
  { label: 'Africa',            names: ['Taghazout', "Jeffrey's Bay", 'Cape Town'] },
  { label: 'Australia',         names: ['Gold Coast', 'Sydney Northern Beaches', 'Margaret River', 'Victoria'] },
  { label: 'Indonesia',         names: ['Uluwatu', 'G-Land', 'Mentawai'] },
  { label: 'Pacific Islands',   names: ['Tahiti', 'Fiji', 'Maldives'] },
  { label: 'Asia',              names: ['Siargao', 'Chiba'] },
]

const REGION_BY_NAME = Object.fromEntries(REGIONS.map(r => [r.name, r]))

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

function fmtSunTime(h: number): string {
  return `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
}

// ── Sunrise / sunset calculator ───────────────────────────────────────────────

function sunTimes(dateStr: string, lat: number): { rise: number; set: number } {
  const date = new Date(dateStr + 'T12:00:00')
  const doy = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
  const B = (360 / 365) * (doy - 81) * (Math.PI / 180)
  const eqTime = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
  const decl = 23.45 * Math.sin(B) * (Math.PI / 180)
  const latRad = lat * (Math.PI / 180)
  const cosHA = -Math.tan(latRad) * Math.tan(decl)
  if (cosHA < -1) return { rise: 0, set: 23 }    // polar day
  if (cosHA >  1) return { rise: 12, set: 12 }    // polar night
  const hourAngle = Math.acos(cosHA) * (180 / Math.PI)
  const noon = 12 - eqTime / 60
  return { rise: noon - hourAngle / 15, set: noon + hourAngle / 15 }
}

// ── Sunrise/sunset bar (draggable) ────────────────────────────────────────────

function SunriseSunsetBar({
  dateStr, hour, lat, onHourChange,
}: {
  dateStr: string
  hour: number
  lat: number
  onHourChange: (h: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  if (!dateStr) return null

  const { rise, set } = sunTimes(dateStr, lat)
  const risePct = (rise / 23) * 100
  const setPct  = (set  / 23) * 100
  const nowPct  = (hour / 23) * 100

  const isDaytime    = hour >= rise && hour <= set
  const isGoldenHour = (hour >= rise && hour <= rise + 1) || (hour >= set - 1 && hour <= set)
  const thumbColor   = isGoldenHour ? '#f97316' : isDaytime ? '#60a5fa' : '#475569'
  const thumbIcon    = isDaytime ? 'sun' : 'moon'

  function seekFromPointer(e: React.PointerEvent<Element>) {
    if (!trackRef.current) return
    const { left, width } = trackRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - left) / width))
    onHourChange(Math.round(pct * 23))
  }

  return (
    <div style={{ marginTop: 10, userSelect: 'none' }}>
      {/* Track container — overflow visible so thumb peeks out */}
      <div
        ref={trackRef}
        style={{ position: 'relative', height: 38, cursor: 'pointer', touchAction: 'none' }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); seekFromPointer(e) }}
        onPointerMove={e => { if (e.buttons) seekFromPointer(e) }}
      >
        {/* Gradient bar — clipped inside */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          top: '50%', transform: 'translateY(-50%)',
          height: 28, borderRadius: 14, overflow: 'hidden',
        }}>
          {/* night → dawn */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${risePct}%`,
            background: 'linear-gradient(to right, #0f172a, #1e3a5f 70%, #f97316)',
          }} />
          {/* daylight */}
          <div style={{
            position: 'absolute', left: `${risePct}%`, top: 0, bottom: 0,
            width: `${Math.max(0, setPct - risePct)}%`,
            background: 'linear-gradient(to right, #f97316, #fbbf24 8%, #87ceeb 20%, #60a5fa 40%, #60a5fa 60%, #87ceeb 80%, #fbbf24 92%, #f97316)',
          }} />
          {/* dusk → night */}
          <div style={{
            position: 'absolute', left: `${setPct}%`, top: 0, bottom: 0, right: 0,
            background: 'linear-gradient(to right, #f97316, #1e3a5f 30%, #0f172a)',
          }} />
          {/* sunrise tick */}
          <div style={{
            position: 'absolute', left: `${risePct}%`, top: 0, bottom: 0,
            width: 1, background: 'rgba(255,255,255,0.45)', transform: 'translateX(-50%)',
          }} />
          {/* sunset tick */}
          <div style={{
            position: 'absolute', left: `${setPct}%`, top: 0, bottom: 0,
            width: 1, background: 'rgba(255,255,255,0.45)', transform: 'translateX(-50%)',
          }} />
        </div>

        {/* Draggable thumb */}
        <div style={{
          position: 'absolute',
          left: `${nowPct}%`, top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 34, height: 34, borderRadius: '50%',
          background: 'white',
          border: `2.5px solid ${thumbColor}`,
          boxShadow: `0 2px 12px rgba(0,0,0,0.25), 0 0 0 4px ${thumbColor}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: thumbColor,
          zIndex: 10,
          pointerEvents: 'none',
          transition: 'border-color 0.15s, color 0.15s, box-shadow 0.15s',
        }}>
          <Icon name={thumbIcon} size={15} strokeWidth={2} />
        </div>
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Icon name="sun" size={10} strokeWidth={2} style={{ color: '#fbbf24' }} />
          {fmtSunTime(rise)}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: isGoldenHour ? '#f97316' : isDaytime ? '#1b7fcb' : '#6b7280',
        }}>
          {isGoldenHour ? 'Golden hour' : isDaytime ? 'Daytime' : 'Night'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
          {fmtSunTime(set)}
          <Icon name="moon" size={10} strokeWidth={2} style={{ color: '#94a3b8' }} />
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

  const selectedDate   = dates[dayIdx] ?? ''
  const currentRegion  = REGION_BY_NAME[region] ?? REGIONS[0]

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

  const swellNow  = swell.find(s => hrFromTime(s.time) === hour) ?? swell[0]
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

        {/* ── Region picker (grouped) ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-3)' }}>
            Region
          </p>
          <div className="space-y-4">
            {REGION_GROUPS.map(group => {
              const groupRegions = group.names.map(n => REGION_BY_NAME[n]).filter(Boolean)
              return (
                <div key={group.label}>
                  <p className="text-xs font-semibold mb-2 px-0.5" style={{ color: 'var(--text-3)', letterSpacing: '0.03em' }}>
                    {group.label}
                  </p>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))' }}>
                    {groupRegions.map(r => {
                      const active = region === r.name
                      return (
                        <button
                          key={r.name}
                          onClick={() => setRegion(r.name)}
                          className="flex flex-col items-center gap-1 rounded-2xl py-3 px-1 transition-all"
                          style={{
                            background: active ? 'var(--ocean-600)' : 'white',
                            border:     `1px solid ${active ? 'var(--ocean-600)' : 'var(--border)'}`,
                            boxShadow:  active ? '0 2px 10px rgba(27,127,203,0.25)' : 'none',
                            transform:  active ? 'translateY(-1px)' : 'none',
                          }}
                        >
                          <span style={{ fontSize: 22, lineHeight: 1, color: active ? 'white' : 'inherit' }}>{r.icon}</span>
                          <span
                            className="text-center font-semibold leading-tight"
                            style={{
                              fontSize: 10,
                              color: active ? 'white' : 'var(--text-2)',
                              maxWidth: 68,
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

          {/* Draggable sunrise/sunset bar — synced to hour state */}
          <SunriseSunsetBar
            dateStr={selectedDate}
            hour={hour}
            lat={currentRegion.lat}
            onHourChange={setHour}
          />
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
                        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--ocean-600)' }}>
                          <Icon name="wave" size={12} strokeWidth={2} />
                          {fmtHeight(hd!.waveHeight, unit)}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                          <Icon name="wind" size={12} strokeWidth={2} />
                          {hd!.windDirectionLabel} {fmtWind(hd!.windSpeed, unit)}
                        </span>
                        {waterTemp !== null && (
                          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0891b2' }}>
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
