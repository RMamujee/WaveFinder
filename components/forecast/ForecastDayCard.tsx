'use client'

import type { ForecastDay, ConditionRating } from '@/types/forecast'
import { format, parseISO } from 'date-fns'
import { degreesToCompass } from '@/lib/forecast/rating'
import { weatherIcon, weatherLabel } from '@/lib/forecast/weather-code'
import { Icon } from '@/components/ui/Icon'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtHeight, fmtWind, fmtTemp } from '@/lib/units'

interface Props {
  day: ForecastDay
  isSelected?: boolean
  onClick?: () => void
}

const RATING_STYLES: Record<ConditionRating, { bg: string; border: string; text: string; dot: string; bar: string }> = {
  poor:  { bg: '#f9fafb', border: '#e5e7eb', text: '#4b5563', dot: '#9ca3af', bar: '#d1d5db' },
  fair:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#f59e0b', bar: '#fbbf24' },
  good:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#16a34a', bar: '#22c55e' },
  epic:  { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', dot: '#7c3aed', bar: '#8b5cf6' },
}

export function ForecastDayCard({ day, isSelected, onClick }: Props) {
  const { unit } = useUnits()
  const date = parseISO(day.date)
  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  const styles = RATING_STYLES[day.dominantRating]

  const hours = day.hours ?? []
  const waterTemps = hours.filter((h) => h.waterTemp != null).map((h) => h.waterTemp!)
  const avgWaterTempC = waterTemps.length > 0
    ? waterTemps.reduce((a, b) => a + b, 0) / waterTemps.length
    : null
  // Headline size is the breaking (face) height, not the raw model sea height —
  // that is the number the rating badge beside it is derived from, and the size
  // a surfer would actually call it. Raw sea/swell stay in the swell panel.
  const minFaceHeight = hours.length > 0 ? Math.min(...hours.map((h) => h.faceHeight)) : 0
  const waveMax = fmtHeight(day.maxFaceHeight, unit)
  const waveMin = fmtHeight(minFaceHeight, unit)
  const waveRange = waveMin !== waveMax ? `${waveMin.replace(/ft|m$/, '')}–${waveMax}` : waveMax

  const avgWindKmh = hours.length > 0
    ? hours.reduce((s, h) => s + h.wind.speed, 0) / hours.length
    : null

  return (
    <button
      onClick={onClick}
      className="w-full h-full rounded-2xl text-left transition-all overflow-hidden flex flex-col hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ocean-400)]"
      style={{
        background: isSelected ? styles.bg : 'white',
        border: `1.5px solid ${isSelected ? styles.bar : 'var(--border)'}`,
        boxShadow: isSelected
          ? `0 2px 8px 0 ${styles.bar}44`
          : '0 1px 3px 0 rgba(0,0,0,0.04)',
      }}
    >
      {/* Rating color bar — top accent */}
      <div style={{ height: 3, background: isSelected ? styles.bar : 'var(--border)', borderRadius: '4px 4px 0 0' }} />

      {/* Weather row */}
      <div
        style={{
          padding: '8px 10px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${isSelected ? styles.border : 'var(--border)'}`,
          background: isSelected ? `${styles.bar}18` : 'var(--sand-50)',
        }}
      >
        <span
          title={day.weatherCode != null ? weatherLabel(day.weatherCode) : undefined}
          style={{ lineHeight: 1 }}
        >
          <Icon name={day.weatherCode != null ? weatherIcon(day.weatherCode) : 'wave'} size={20} />
        </span>
        <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
          {day.maxTempC !== null && (
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              {fmtTemp(day.maxTempC, unit)}
            </div>
          )}
          {day.minTempC !== null && (
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
              {fmtTemp(day.minTempC, unit)}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: '10px 10px 12px' }} className="flex-1 flex flex-col">
        {/* Day / date */}
        <p
          className="font-bold text-xs"
          style={{ color: isSelected ? styles.text : 'var(--text-2)', marginBottom: 1 }}
        >
          {isToday ? 'Today' : format(date, 'EEE')}
        </p>
        <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>
          {format(date, 'M/d')}
        </p>

        {/* Wave height */}
        <p
          style={{
            fontFamily: 'var(--font-playfair), serif',
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--text)',
            marginBottom: 4,
          }}
        >
          {waveRange}
        </p>

        {/* Rating badge */}
        <div
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 mb-2 self-start"
          style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
        >
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: styles.dot }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: styles.text, textTransform: 'capitalize' }}>
            {day.dominantRating}
          </span>
        </div>

        {/* Swell */}
        <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>
          {Math.round(day.avgPeriod)}s {hours[0] ? degreesToCompass(hours[0].swellDirection) : ''}
        </p>

        {/* Wind */}
        {avgWindKmh !== null && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>
            <Icon name="wind" size={12} className="inline mr-1" style={{ color: 'var(--text-3)' }} />{fmtWind(avgWindKmh, unit)}
          </p>
        )}

        {/* Water temp */}
        {avgWaterTempC !== null && (
          <p style={{ fontSize: 11, color: '#0c5f74', fontWeight: 600, marginBottom: 2 }}>
            <Icon name="wave" size={12} className="inline mr-1" style={{ color: '#0c5f74' }} />{fmtTemp(avgWaterTempC, unit)}
          </p>
        )}

        {/* Rain chance */}
        {day.maxPrecipProb !== null && day.maxPrecipProb >= 20 && (
          <p style={{ fontSize: 11, color: '#1b7fcb', fontWeight: 600 }}>
            <Icon name="droplet" size={12} className="inline mr-1" style={{ color: '#1b7fcb' }} />{day.maxPrecipProb}%
          </p>
        )}
      </div>
    </button>
  )
}
