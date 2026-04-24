'use client'

import type { BestTimeSlot } from '@/lib/forecast/best-time'
import type { ConditionRating, TidePoint } from '@/types/forecast'

interface Props {
  slots: BestTimeSlot[]
  tides?: TidePoint[]
}

const WINDOW_ICONS: Record<string, string> = {
  dawn: '🌅',
  morning: '○',
  midday: '◑',
  afternoon: '≈',
  evening: '🌇',
}

const WIND_ICONS: Record<string, string> = {
  glassy: '🪞',
  'light offshore': '💨',
  'light onshore': '〰️',
  choppy: '≋',
}

const RATING_STYLES: Record<ConditionRating, { bg: string; border: string; text: string; bar: string }> = {
  poor:  { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', bar: '#d1d5db' },
  fair:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', bar: '#f59e0b' },
  good:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', bar: '#16a34a' },
  epic:  { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', bar: '#7c3aed' },
}

export function BestTimePanel({ slots, tides }: Props) {
  if (!slots.length) return null

  const best = [...slots].sort((a, b) => b.avgScore - a.avgScore)[0]

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      {/* Header */}
      <div
        className="px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--sand-50)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3
              className="font-semibold"
              style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', color: 'var(--text)' }}
            >
              Best Times to Surf Today
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Based on waves, wind, swell period, and direction
            </p>
          </div>
          {best.recommended && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: RATING_STYLES[best.rating].bg,
                border: `1px solid ${RATING_STYLES[best.rating].border}`,
                color: RATING_STYLES[best.rating].text,
              }}
            >
              ✦ Best: {best.label}
            </div>
          )}
        </div>
      </div>

      {/* Slots */}
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {slots.map((slot) => {
          const styles = RATING_STYLES[slot.rating]
          const isTop = slot === best && slot.recommended

          return (
            <div
              key={slot.window}
              className="px-5 py-4 transition-colors"
              style={{
                background: isTop ? styles.bg : 'white',
              }}
            >
              <div className="flex items-start gap-4">
                {/* Icon + window label */}
                <div className="shrink-0 text-center" style={{ minWidth: '56px' }}>
                  <div className="text-xl">{WINDOW_ICONS[slot.window]}</div>
                  <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-2)' }}>
                    {slot.label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {slot.timeRange.split(' – ')[0]}
                  </div>
                </div>

                {/* Score bar + details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold rounded-full px-2.5 py-0.5"
                        style={{
                          background: styles.bg,
                          border: `1.5px solid ${styles.border}`,
                          color: styles.text,
                        }}
                      >
                        {slot.rating.toUpperCase()}
                      </span>
                      {isTop && (
                        <span className="text-xs font-medium" style={{ color: 'var(--ocean-600)' }}>
                          ← Recommended
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                      {slot.avgScore}/100
                    </span>
                  </div>

                  {/* Score bar */}
                  <div
                    className="h-1.5 w-full rounded-full mb-3"
                    style={{ background: 'var(--sand-200)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${slot.avgScore}%`,
                        background: styles.bar,
                      }}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <WaveHeightTrend slot={slot} />
                    <TideTrend slot={slot} tides={tides} />
                    <Stat label="Period" value={`${slot.avgPeriod}s`} />
                    <Stat
                      label="Wind"
                      value={`${WIND_ICONS[slot.windQuality]} ${slot.windQuality}`}
                    />
                  </div>

                  {/* Tip */}
                  <p className="text-xs italic" style={{ color: 'var(--text-2)' }}>
                    {slot.tip}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}: </span>
      <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

function TideTrend({ slot, tides }: { slot: BestTimeSlot; tides?: TidePoint[] }) {
  if (!tides?.length || !slot.hours.length) return null

  // Find tide points whose time falls within this slot's window
  const startTime = slot.hours[0].time
  const endTime   = slot.hours[slot.hours.length - 1].time

  const slotTides = tides.filter((t) => t.time >= startTime && t.time <= endTime)
  if (slotTides.length < 2) {
    // Fall back: use closest tide points bracketing the window
    const before = tides.filter((t) => t.time <= startTime).pop()
    const after  = tides.find((t) => t.time >= endTime)
    if (!before || !after) return null
    slotTides.push(before, after)
  }

  const firstHeight = slotTides[0].height
  const lastHeight  = slotTides[slotTides.length - 1].height
  const diff = lastHeight - firstHeight

  let arrow = '→'
  let label = 'steady'
  let color = 'var(--text-3)'
  if (diff > 0.05)  { arrow = '↑'; label = 'rising';  color = '#1b7fcb' }
  if (diff < -0.05) { arrow = '↓'; label = 'dropping'; color = '#c9a87c' }

  const heightLabel = `${firstHeight.toFixed(1)}m`

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Tide: </span>
      <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{heightLabel}</span>
      <span className="text-xs font-bold" style={{ color }} title={label}>{arrow}</span>
      <span className="text-xs" style={{ color }}>{label}</span>
    </div>
  )
}

function WaveHeightTrend({ slot }: { slot: BestTimeSlot }) {
  const hours = slot.hours
  if (!hours.length) return null

  const first = hours[0].waveHeight
  const last  = hours[hours.length - 1].waveHeight
  const diff  = last - first

  // trend arrow + label
  let arrow = '→'
  let trendLabel = 'steady'
  let trendColor = 'var(--text-3)'
  if (diff > 0.1)  { arrow = '↑'; trendLabel = 'building'; trendColor = '#16a34a' }
  if (diff < -0.1) { arrow = '↓'; trendLabel = 'dropping'; trendColor = '#ef4444' }

  const startFt = Math.round(first * 3.281)
  const endFt   = Math.round(last  * 3.281)
  const heightStr = startFt === endFt
    ? `${startFt}ft`
    : `${startFt}–${endFt}ft`

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Waves: </span>
      <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{heightStr}</span>
      <span className="text-xs font-bold" style={{ color: trendColor }} title={trendLabel}>
        {arrow}
      </span>
      <span className="text-xs" style={{ color: trendColor }}>{trendLabel}</span>
    </div>
  )
}
