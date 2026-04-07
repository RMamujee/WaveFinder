'use client'

import type { ForecastHour, ForecastDay } from '@/types/forecast'

interface Props {
  current: ForecastHour | null
  activeDayData: ForecastDay | undefined
  spotLat: number
  spotLng: number
}

// --- Rip Current Risk ---
function getRipRisk(waveHeight: number, swellPeriod: number): {
  level: string
  color: string
  desc: string
} {
  const power = waveHeight * swellPeriod
  if (power < 3) return { level: 'Low', color: '#16a34a', desc: 'Minimal rip hazard' }
  if (power < 8) return { level: 'Moderate', color: '#d97706', desc: 'Exercise caution near breaks' }
  if (power < 15) return { level: 'High', color: '#dc2626', desc: 'Strong rips likely. Swim near lifeguards.' }
  return { level: 'Extreme', color: '#7f1d1d', desc: 'Life-threatening rip currents' }
}

// --- Water Clarity ---
function getWaterClarity(waveHeight: number): { label: string; color: string } {
  if (waveHeight < 0.5) return { label: 'Crystal Clear', color: '#0ea5e9' }
  if (waveHeight < 1.2) return { label: 'Good', color: '#0369a1' }
  if (waveHeight < 2) return { label: 'Reduced', color: '#b45309' }
  return { label: 'Murky', color: '#6b7280' }
}

// --- Surf Hazards ---
interface Hazard {
  label: string
  color: string
  bg: string
}

function getSurfHazards(waveHeight: number, windSpeedKmh: number): Hazard[] {
  const hazards: Hazard[] = []
  if (waveHeight > 2.5) hazards.push({ label: 'Large Surf', color: '#dc2626', bg: '#fef2f2' })
  if (windSpeedKmh > 32) hazards.push({ label: 'High Winds', color: '#d97706', bg: '#fffbeb' })
  if (waveHeight < 0.3) hazards.push({ label: 'Flat — No Waves', color: '#6b7280', bg: '#f9fafb' })
  if (hazards.length === 0) hazards.push({ label: 'Normal Conditions', color: '#16a34a', bg: '#f0fdf4' })
  return hazards
}

// --- Beach Flag ---
function getBeachFlag(ripLevel: string, hazards: Hazard[]): { label: string; color: string } {
  const hasLargeSurf = hazards.some((h) => h.label === 'Large Surf')
  if (ripLevel === 'Extreme') return { label: 'Double Red — Water Closed', color: '#7f1d1d' }
  if (ripLevel === 'High' || hasLargeSurf) return { label: 'Red Flag', color: '#dc2626' }
  if (ripLevel === 'Moderate') return { label: 'Yellow Flag', color: '#d97706' }
  return { label: 'Green Flag', color: '#16a34a' }
}

interface TileProps {
  label: string
  children: React.ReactNode
}

function Tile({ label, children }: TileProps) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

export function BeachSafetyPanel({ current, activeDayData, spotLat: _spotLat, spotLng: _spotLng }: Props) {
  // Use current if available, otherwise fall back to first hour of active day
  const ref = current ?? activeDayData?.hours[0] ?? null

  if (!ref) {
    return (
      <div className="rounded-2xl p-5 text-sm text-center" style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
        No condition data available.
      </div>
    )
  }

  const rip = getRipRisk(ref.waveHeight, ref.swellPeriod)
  const clarity = getWaterClarity(ref.waveHeight)
  const hazards = getSurfHazards(ref.waveHeight, ref.wind.speed)
  const flag = getBeachFlag(rip.level, hazards)

  const waterTempF = ref.waterTemp !== null
    ? `${Math.round(ref.waterTemp * 9 / 5 + 32)}°F`
    : '—'

  return (
    <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
      {/* Title row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>🏖️</span>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Beach Safety</h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Estimated from conditions
          </p>
        </div>
      </div>

      {/* 3×2 metric grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

        {/* Rip Current Risk */}
        <Tile label="Rip Current Risk">
          <p className="font-semibold text-sm" style={{ color: rip.color }}>{rip.level}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{rip.desc}</p>
        </Tile>

        {/* Water Clarity */}
        <Tile label="Water Clarity">
          <p className="font-semibold text-sm" style={{ color: clarity.color }}>{clarity.label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {ref.waveHeight < 0.5 ? 'Calm, low turbidity' : ref.waveHeight < 1.2 ? 'Some surface disturbance' : ref.waveHeight < 2 ? 'Wave action stirring sand' : 'Heavy churn, poor visibility'}
          </p>
        </Tile>

        {/* Surf Hazards */}
        <Tile label="Surf Hazard">
          <div className="flex flex-wrap gap-1 mt-0.5">
            {hazards.map((h) => (
              <span
                key={h.label}
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: h.bg, color: h.color, border: `1px solid ${h.color}33` }}
              >
                {h.label}
              </span>
            ))}
          </div>
        </Tile>

        {/* Water Temp */}
        <Tile label="Water Temp">
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{waterTempF}</p>
          {ref.waterTemp !== null && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {ref.waterTemp.toFixed(1)}°C
            </p>
          )}
        </Tile>

        {/* Lifeguard Status */}
        <Tile label="Lifeguard Status">
          <p className="font-semibold text-sm" style={{ color: '#0369a1' }}>Seasonal Service</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Hours and coverage vary by beach. Check posted flags and local beach patrol.
          </p>
        </Tile>

        {/* Beach Flag */}
        <Tile label="Beach Flag">
          <div className="flex items-center gap-2 mt-0.5">
            {/* Colored flag icon */}
            <div
              className="shrink-0"
              style={{
                width: 16,
                height: 20,
                background: flag.color,
                borderRadius: 2,
                boxShadow: `0 1px 3px ${flag.color}55`,
              }}
            />
            <p className="font-semibold text-sm" style={{ color: flag.color }}>{flag.label}</p>
          </div>
        </Tile>

      </div>
    </div>
  )
}
