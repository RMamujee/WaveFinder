'use client'

import Link from 'next/link'
import type { SurfSpot } from '@/types/spot'
import type { ConditionRating } from '@/types/forecast'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtHeight, fmtWind, fmtTemp } from '@/lib/units'
import { MiniWave } from '@/components/ui/MiniWave'
import { Icon } from '@/components/ui/Icon'

interface Props {
  spot: SurfSpot
  rating?: ConditionRating
  waveHeight?: number
  period?: number   // swell period in seconds
  wind?: number     // wind speed in knots
  tempF?: number    // water temperature in Fahrenheit
}

const DIFFICULTY_STYLES = {
  beginner:     { color: '#15803d', bg: '#f0fdf4' },
  intermediate: { color: '#b45309', bg: '#fffbeb' },
  advanced:     { color: '#b91c1c', bg: '#fef2f2' },
  expert:       { color: '#6b21a8', bg: '#faf5ff' },
}

const RATING_DOTS: Record<ConditionRating, string> = {
  poor: '#9ca3af', fair: '#f59e0b', good: '#16a34a', epic: '#7c3aed',
}

export function SpotCard({ spot, rating, waveHeight, period, wind, tempF }: Props) {
  const { unit } = useUnits()
  const diffStyle = DIFFICULTY_STYLES[spot.difficulty as keyof typeof DIFFICULTY_STYLES] ?? DIFFICULTY_STYLES.intermediate
  const hasMicro = period !== undefined || wind !== undefined || tempF !== undefined

  // Convert to metric for fmtWind/fmtTemp (they expect m/s and °C)
  const windMs  = wind  !== undefined ? wind  * 0.514 : undefined
  const tempC   = tempF !== undefined ? (tempF - 32) * 5 / 9 : undefined

  return (
    <Link
      href={`/spots/${spot.slug}`}
      className="group block rounded-xl transition-all overflow-hidden"
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className="font-semibold truncate transition-colors group-hover:text-[var(--ocean-600)]"
              style={{ fontSize: '14px', color: 'var(--text)' }}
            >
              {spot.name}
            </h3>
            <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{spot.region}</p>
          </div>
          {rating && (
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0 mt-1"
              style={{ background: RATING_DOTS[rating] }}
              title={rating}
            />
          )}
        </div>
      </div>

      {/* Mini wave strip — between header and footer, full card width */}
      {waveHeight !== undefined && (
        <div
          className="-mx-0"
          style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
        >
          <MiniWave
            height={waveHeight}
            period={period ?? 12}
            wind={wind ?? 6}
            width={232}
            h={44}
          />
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pt-3 pb-4 space-y-2">
        <div className="flex items-center justify-between">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
            style={{ background: diffStyle.bg, color: diffStyle.color }}
          >
            {spot.difficulty}
          </span>
          {waveHeight !== undefined && (
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {fmtHeight(waveHeight, unit)}
            </span>
          )}
        </div>

        {/* Micro-stats row — variant B */}
        {hasMicro && (
          <div className="flex items-center gap-3 pt-0.5">
            {period !== undefined && (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                <Icon name="wave" size={12} strokeWidth={1.8} />
                {period}s
              </span>
            )}
            {windMs !== undefined && (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                <Icon name="wind" size={12} strokeWidth={1.8} />
                {fmtWind(windMs, unit)}
              </span>
            )}
            {tempC !== undefined && (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--ocean-600)' }}>
                <Icon name="temp" size={12} strokeWidth={1.8} />
                {fmtTemp(tempC, unit)}
              </span>
            )}
          </div>
        )}
      </div>

    </Link>
  )
}
