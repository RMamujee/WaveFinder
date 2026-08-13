'use client'

import type { SurfSpot } from '@/types/spot'
import type { ForecastHour, BuoyReading, CoastalWindReading } from '@/types/forecast'
import { degreesToCompass } from '@/lib/forecast/rating'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtHeight, fmtWindMps } from '@/lib/units'

interface Props {
  spot: SurfSpot
  current: ForecastHour | null
  buoy?: BuoyReading | null
  coastalWind?: CoastalWindReading | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

// ── Ideal size by difficulty ───────────────────────────────────────────────────
const IDEAL: Record<string, { minFt: number; maxFt: number; period: string; tideNote: string }> = {
  beginner:     { minFt: 1, maxFt: 4,  period: '8–11s',  tideNote: 'Mid to high tide' },
  intermediate: { minFt: 3, maxFt: 8,  period: '10–14s', tideNote: 'Any tide' },
  advanced:     { minFt: 5, maxFt: 15, period: '12–18s', tideNote: 'Low to mid tide' },
  expert:       { minFt: 8, maxFt: 40, period: '14–20s', tideNote: 'Low to mid tide' },
}

// ── Mini compass SVG ───────────────────────────────────────────────────────────
// `deg`: compass bearing (0 = North, 90 = East, clockwise)
// Arrow tip points in the direction FROM which the wind/swell comes.
function CompassRose({ deg, color }: { deg: number; color: string }) {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
      {/* Background */}
      <circle cx="28" cy="28" r="26" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Cardinal ticks — N is bolder */}
      <line x1="28" y1="2"  x2="28" y2="10" stroke="#94a3b8" strokeWidth="2"   strokeLinecap="round" />
      <line x1="54" y1="28" x2="46" y2="28" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="28" y1="54" x2="28" y2="46" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2"  y1="28" x2="10" y2="28" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
      {/* Directional arrow — rotated around center */}
      <g transform={`rotate(${deg}, 28, 28)`}>
        {/* Arrowhead */}
        <polygon points="28,5 23.5,15 32.5,15" fill={color} />
        {/* Shaft */}
        <line x1="28" y1="15" x2="28" y2="28" stroke={color} strokeWidth="3" strokeLinecap="round" />
        {/* Tail (faded) */}
        <line x1="28" y1="28" x2="28" y2="44" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.3" />
      </g>
      {/* Center hub */}
      <circle cx="28" cy="28" r="3.5" fill={color} />
    </svg>
  )
}

// ── Match pill ─────────────────────────────────────────────────────────────────
function MatchPill({ label, match, partial }: { label: string; match: boolean; partial?: boolean }) {
  const bg    = match ? '#f0fdf4' : partial ? '#fffbeb' : '#fef2f2'
  const color = match ? '#16a34a' : partial ? '#d97706' : '#dc2626'
  const icon  = match ? '✓' : partial ? '~' : '✗'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: bg, color }}
    >
      {icon} {label}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function IdealConditionsPanel({ spot, current, buoy, coastalWind }: Props) {
  const { unit } = useUnits()
  const offshoreDir = (spot.facingDirection + 180) % 360
  const ideal = IDEAL[spot.difficulty] ?? IDEAL.intermediate

  // ── Determine best available observed/forecast wind source ──────────────────
  // Priority: NOAA CO-OPS coastal observed > NOAA NDBC buoy observed > Open-Meteo forecast
  let obsWindSpeedMps: number | null = null
  let obsWindDir: number | null = null
  let obsSource = 'Open-Meteo forecast'

  if (coastalWind && coastalWind.speedMps != null && coastalWind.directionDeg != null) {
    obsWindSpeedMps = coastalWind.speedMps
    obsWindDir = coastalWind.directionDeg
    obsSource = `NOAA CO-OPS ${coastalWind.stationId} · observed`
  } else if (buoy?.windSpeed != null && buoy.windDirection != null) {
    obsWindSpeedMps = buoy.windSpeed
    obsWindDir = buoy.windDirection
    obsSource = `NOAA Buoy ${spot.noaaBuoyId ?? ''} · observed`
  } else if (current) {
    // wind.speed is in km/h from Open-Meteo
    obsWindSpeedMps = current.wind.speed / 3.6
    obsWindDir = current.wind.direction
  }

  // ── Compute break character ─────────────────────────────────────────────────
  let breakLabel = '—'
  let breakColor = 'var(--text-3)'
  let windMatch = false
  let windPartial = false

  if (obsWindSpeedMps !== null && obsWindDir !== null) {
    const windMph = obsWindSpeedMps * 2.237

    if (windMph < 5) {
      breakLabel = 'Glassy'
      breakColor = '#16a34a'
      windMatch = true
    } else {
      const diff = angleDiff(obsWindDir, offshoreDir)
      if (diff <= 45) {
        breakLabel = windMph < 20 ? 'Offshore' : 'Strong Offshore'
        breakColor = windMph < 20 ? '#0369a1' : '#0c4a6e'
        windMatch = true
      } else if (diff <= 90) {
        breakLabel = 'Cross-offshore'
        breakColor = '#0891b2'
        windPartial = true
      } else if (diff <= 135) {
        breakLabel = 'Cross-onshore'
        breakColor = '#d97706'
      } else {
        breakLabel = windMph < 10 ? 'Light Onshore' : 'Onshore'
        breakColor = windMph < 10 ? '#b45309' : '#dc2626'
      }
    }
  }

  // ── Swell angle match ───────────────────────────────────────────────────────
  let swellMatch = false
  let swellPartial = false
  if (current) {
    const diff = angleDiff(current.swellDirection, spot.facingDirection)
    swellMatch   = diff <= 30
    swellPartial = diff > 30 && diff <= 60
  }

  // ── Size match ──────────────────────────────────────────────────────────────
  let sizeMatch = false
  let sizePartial = false
  if (current) {
    const ft = current.waveHeight * 3.281
    sizeMatch   = ft >= ideal.minFt && ft <= ideal.maxFt + 2
    sizePartial = (ft >= ideal.minFt * 0.5 && ft < ideal.minFt) ||
                  (ft > ideal.maxFt + 2 && ft <= ideal.maxFt + 5)
  }

  const hasCurrent = current !== null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--border)' }}>
      {/* ── Ideal conditions grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 divide-x" style={{ borderBottom: '1px solid var(--border)' }}>
        {/* Wind */}
        <div className="flex flex-col items-center gap-2 p-4">
          <CompassRose deg={offshoreDir} color="#0369a1" />
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {degreesToCompass(offshoreDir)} Offshore
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Ideal wind direction</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Under {fmtWindMps(6.7, unit)}</p>
          </div>
        </div>

        {/* Swell */}
        <div className="flex flex-col items-center gap-2 p-4">
          <CompassRose deg={spot.facingDirection} color="#7c3aed" />
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {degreesToCompass(spot.facingDirection)} ({spot.facingDirection}°)
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Ideal swell direction</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>±45° window</p>
          </div>
        </div>

        {/* Size */}
        <div className="flex flex-col items-center justify-center gap-2 p-4">
          <p
            style={{
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1,
              fontFamily: 'var(--font-playfair), serif',
              color: 'var(--text)',
            }}
          >
            {fmtHeight(ideal.minFt / 3.281, unit)}–{fmtHeight(ideal.maxFt / 3.281, unit)}
          </p>
          <div className="text-center">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>{ideal.period} period</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{ideal.tideNote}</p>
          </div>
        </div>
      </div>

      {/* ── Currently breaking ──────────────────────────────────────────────── */}
      <div className="p-4">
        {hasCurrent ? (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p
                className="text-xs font-semibold mb-1"
                style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Currently breaking
              </p>
              <p
                className="font-black"
                style={{ fontSize: 22, fontFamily: 'var(--font-playfair), serif', color: breakColor, lineHeight: 1 }}
              >
                {breakLabel}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{obsSource}</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-1">
              <MatchPill label="Wind dir" match={windMatch}  partial={windPartial} />
              <MatchPill label="Swell angle" match={swellMatch} partial={swellPartial} />
              <MatchPill label="Wave size"   match={sizeMatch}  partial={sizePartial} />
            </div>
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Loading current conditions…</p>
        )}
      </div>
    </div>
  )
}
