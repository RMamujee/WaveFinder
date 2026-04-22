'use client'

import { format, parseISO } from 'date-fns'
import type { ForecastHour, ForecastDay } from '@/types/forecast'
import { degreesToCompass } from '@/lib/forecast/rating'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtHeightDec } from '@/lib/units'

interface Props {
  current: ForecastHour
  activeDayData?: ForecastDay
}

interface SwellType {
  label: string
  sublabel: string
  quality: string   // plain text quality note
  bg: string
  border: string
  text: string
  accent: string
  bar: number       // 0–100 quality score
}

function classifySwellType(period: number): SwellType {
  if (period >= 17) return {
    label: 'Long Period',
    sublabel: 'Swell',
    quality: 'Powerful deep-ocean energy — premium conditions',
    bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', accent: '#7c3aed',
    bar: 100,
  }
  if (period >= 13) return {
    label: 'Ground',
    sublabel: 'Swell',
    quality: 'Well-organised ocean swell — quality waves',
    bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', accent: '#16a34a',
    bar: 82,
  }
  if (period >= 9) return {
    label: 'Mixed',
    sublabel: 'Swell',
    quality: 'Blend of swell and wind chop — variable surf',
    bg: '#fffbeb', border: '#fde68a', text: '#92400e', accent: '#f59e0b',
    bar: 52,
  }
  return {
    label: 'Wind',
    sublabel: 'Swell',
    quality: 'Short-period wind chop — expect choppy faces',
    bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', accent: '#9ca3af',
    bar: 20,
  }
}

// Compass arrow SVG pointing in the given direction
function DirectionCompass({ degrees }: { degrees: number }) {
  // rotate arrow: 0° = N (up), 90° = E (right), etc.
  return (
    <svg
      width="72" height="72" viewBox="0 0 72 72"
      style={{ display: 'block' }}
    >
      {/* Outer ring */}
      <circle cx="36" cy="36" r="33" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Cardinal labels */}
      {[['N', 36, 8], ['S', 36, 68], ['E', 67, 40], ['W', 5, 40]].map(([l, x, y]) => (
        <text key={l as string} x={x as number} y={y as number} textAnchor="middle"
          fontSize="8" fontWeight="600" fill="#94a3b8" fontFamily="DM Sans, sans-serif">
          {l}
        </text>
      ))}
      {/* Arrow group, rotated to match direction */}
      <g transform={`rotate(${degrees}, 36, 36)`}>
        {/* Tail */}
        <line x1="36" y1="48" x2="36" y2="24" stroke="#1b7fcb" strokeWidth="2.5" strokeLinecap="round" />
        {/* Arrowhead */}
        <polygon points="36,14 31,24 41,24" fill="#1b7fcb" />
        {/* Tail circle */}
        <circle cx="36" cy="48" r="3" fill="#c7d9f0" />
      </g>
    </svg>
  )
}

export function SwellPanel({ current, activeDayData }: Props) {
  const { unit } = useUnits()
  const type = classifySwellType(current.swellPeriod)

  // Find peak period hour in the selected day
  let peakHour: ForecastHour | null = null
  if (activeDayData?.hours.length) {
    peakHour = activeDayData.hours.reduce((best, h) =>
      h.swellPeriod > best.swellPeriod ? h : best
    )
  }

  // Period trend through the day (for mini sparkline)
  const dayHours = activeDayData?.hours ?? []
  const maxPeriod = Math.max(...dayHours.map(h => h.swellPeriod), current.swellPeriod, 1)

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'white', border: '1px solid var(--border)' }}
    >
      {/* Header band */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ background: type.bg, borderBottom: `1px solid ${type.border}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: type.text }}>
            Swell
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{ background: type.border, color: type.text }}
          >
            {type.label} {type.sublabel}
          </span>
        </div>
        <span className="text-xs" style={{ color: type.text, opacity: 0.75 }}>
          {current.swellDirection}° · {degreesToCompass(current.swellDirection)}
        </span>
      </div>

      {/* Main content */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-5">

        {/* Period + compass row */}
        <div className="flex items-center justify-between gap-4">
          {/* Period (big) */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>
              Period
            </p>
            <div className="flex items-baseline gap-1.5">
              <span
                style={{
                  fontSize: '56px',
                  fontWeight: 800,
                  fontFamily: 'Playfair Display, serif',
                  color: type.accent,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}
              >
                {Math.round(current.swellPeriod)}
              </span>
              <span className="text-xl font-bold" style={{ color: 'var(--text-3)', marginBottom: '4px' }}>s</span>
            </div>
            <p className="text-xs mt-1" style={{ color: type.text, fontStyle: 'italic' }}>
              {type.quality}
            </p>
          </div>

          {/* Compass */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <DirectionCompass degrees={current.swellDirection} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
              {degreesToCompass(current.swellDirection)}
            </span>
          </div>
        </div>

        {/* Quality bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>Swell quality</span>
            <span className="text-xs font-bold" style={{ color: type.accent }}>{type.bar}/100</span>
          </div>
          <div className="h-2 w-full rounded-full" style={{ background: 'var(--sand-200)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${type.bar}%`, background: `linear-gradient(to right, ${type.accent}99, ${type.accent})` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Swell height</p>
            <p className="font-bold text-base" style={{ color: 'var(--text)', lineHeight: 1 }}>
              {fmtHeightDec(current.swellHeight, unit)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {current.swellHeight.toFixed(2)}m
            </p>
          </div>

          <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Direction</p>
            <p className="font-bold text-base" style={{ color: 'var(--text)', lineHeight: 1 }}>
              {degreesToCompass(current.swellDirection)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {current.swellDirection}°
            </p>
          </div>
        </div>

        {/* Peak time */}
        {peakHour && (
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: type.bg, border: `1px solid ${type.border}` }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: type.text }}>
                Peak period today
              </p>
              <p className="text-xs" style={{ color: type.text, opacity: 0.8 }}>
                Best swell energy of the day
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black" style={{ color: type.accent, fontFamily: 'Playfair Display, serif' }}>
                {format(parseISO(peakHour.time), 'h a')}
              </p>
              <p className="text-xs font-bold" style={{ color: type.text }}>
                {Math.round(peakHour.swellPeriod)}s
              </p>
            </div>
          </div>
        )}

        {/* Mini period-through-day sparkline */}
        {dayHours.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-3)' }}>Period through the day</p>
            <div className="flex items-end gap-0.5 h-10">
              {dayHours.map((h, i) => {
                const heightPct = (h.swellPeriod / maxPeriod) * 100
                const isPeak    = h === peakHour
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all"
                    title={`${format(parseISO(h.time), 'ha')}: ${Math.round(h.swellPeriod)}s`}
                    style={{
                      height: `${Math.max(8, heightPct)}%`,
                      background: isPeak ? type.accent : `${type.accent}55`,
                      minWidth: '3px',
                    }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {dayHours[0] ? format(parseISO(dayHours[0].time), 'ha') : ''}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {dayHours[dayHours.length - 1] ? format(parseISO(dayHours[dayHours.length - 1].time), 'ha') : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
