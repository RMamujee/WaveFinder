import type { ForecastDay, ConditionRating } from '@/types/forecast'
import { format, parseISO } from 'date-fns'
import { degreesToCompass } from '@/lib/forecast/rating'
import { weatherIcon, weatherLabel, tempF } from '@/lib/forecast/weather-code'

interface Props {
  day: ForecastDay
  isSelected?: boolean
  onClick?: () => void
}

const RATING_STYLES: Record<ConditionRating, { bg: string; border: string; text: string; dot: string }> = {
  poor:  { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', dot: '#9ca3af' },
  fair:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#f59e0b' },
  good:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#16a34a' },
  epic:  { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', dot: '#7c3aed' },
}

function metersToFeet(m: number) {
  return `${Math.round(m * 3.281)}ft`
}

export function ForecastDayCard({ day, isSelected, onClick }: Props) {
  const date = parseISO(day.date)
  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  const styles = RATING_STYLES[day.dominantRating]
  const hasWeather = day.weatherCode !== null || day.maxTempC !== null

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl text-left transition-all overflow-hidden"
      style={{
        background: isSelected ? styles.bg : 'white',
        border: `1.5px solid ${isSelected ? styles.border : 'var(--border)'}`,
        boxShadow: isSelected ? `0 0 0 1px ${styles.border}` : 'none',
      }}
    >
      {/* Weather strip — top of card */}
      {hasWeather && (
        <div
          style={{
            background: isSelected ? `${styles.border}55` : 'var(--sand-50)',
            borderBottom: `1px solid ${isSelected ? styles.border : 'var(--border)'}`,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>
            {weatherIcon(day.weatherCode)}
          </span>
          <div style={{ textAlign: 'right' }}>
            {day.maxTempC !== null && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                {tempF(day.maxTempC)}
              </span>
            )}
            {day.minTempC !== null && day.maxTempC !== null && (
              <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 2 }}>
                / {tempF(day.minTempC)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ padding: '10px 10px 10px' }}>
        {/* Day / date */}
        <p className="text-xs font-semibold" style={{ color: isSelected ? styles.text : 'var(--text-2)' }}>
          {isToday ? 'Today' : format(date, 'EEE')}
        </p>
        <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
          {format(date, 'M/d')}
        </p>

        {/* Wave height */}
        <p
          className="font-bold"
          style={{ fontSize: '16px', color: 'var(--text)', fontFamily: 'Playfair Display, serif', lineHeight: 1 }}
        >
          {metersToFeet(day.maxWaveHeight)}
        </p>
        <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
          {day.maxWaveHeight}m
        </p>

        {/* Surf rating */}
        <div className="flex items-center gap-1 mb-1">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: styles.dot }} />
          <p className="text-xs font-semibold capitalize" style={{ color: styles.text }}>
            {day.dominantRating}
          </p>
        </div>

        {/* Swell */}
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          {Math.round(day.avgPeriod)}s {day.hours[0] ? degreesToCompass(day.hours[0].swellDirection) : ''}
        </p>

        {/* Rain chance */}
        {day.maxPrecipProb !== null && day.maxPrecipProb >= 20 && (
          <p className="text-xs mt-1.5 font-medium" style={{ color: '#1b7fcb' }}>
            💧 {day.maxPrecipProb}%
          </p>
        )}
      </div>
    </button>
  )
}
