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

  // Computed from hours
  const waterTemps = day.hours.filter((h) => h.waterTemp != null).map((h) => h.waterTemp!)
  const avgWaterTempF = waterTemps.length > 0
    ? Math.round((waterTemps.reduce((a, b) => a + b, 0) / waterTemps.length) * 9 / 5 + 32)
    : null
  const powers = day.hours.filter((h) => h.wavePower > 0).map((h) => h.wavePower)
  const avgPower = powers.length > 0 ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : null
  const minWaveHeight = day.hours.length > 0 ? Math.min(...day.hours.map((h) => h.waveHeight)) : null

  return (
    <button
      onClick={onClick}
      className="w-full h-full rounded-xl text-left transition-all overflow-hidden flex flex-col"
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
      <div style={{ padding: '10px 10px 10px' }} className="flex-1 flex flex-col">
        {/* Day / date */}
        <p className="text-xs font-semibold" style={{ color: isSelected ? styles.text : 'var(--text-2)' }}>
          {isToday ? 'Today' : format(date, 'EEE')}
        </p>
        <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>
          {format(date, 'M/d')}
        </p>

        {/* Wave height — min–max range */}
        <p
          className="font-bold"
          style={{ fontSize: '16px', color: 'var(--text)', fontFamily: 'Playfair Display, serif', lineHeight: 1 }}
        >
          {minWaveHeight != null && Math.round(minWaveHeight * 3.281) < Math.round(day.maxWaveHeight * 3.281)
            ? `${Math.round(minWaveHeight * 3.281)}–${metersToFeet(day.maxWaveHeight)}`
            : metersToFeet(day.maxWaveHeight)}
        </p>
        {/* Surf rating */}
        <div className="flex items-center gap-1 mb-1">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: styles.dot }} />
          <p className="text-xs font-semibold capitalize" style={{ color: styles.text }}>
            {day.dominantRating}
          </p>
        </div>

        {/* Swell period + direction */}
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          {Math.round(day.avgPeriod)}s {day.hours[0] ? degreesToCompass(day.hours[0].swellDirection) : ''}
        </p>

        {/* Wind avg */}
        {(() => {
          const avgWind = day.hours.length > 0
            ? Math.round(day.hours.reduce((s, h) => s + h.wind.speed, 0) / day.hours.length * 0.621371)
            : null
          return avgWind !== null ? (
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              💨 {avgWind} mph
            </p>
          ) : null
        })()}

        {/* Wave power */}
        {avgPower !== null && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            ⚡ {avgPower} kW/m
          </p>
        )}

        {/* Water temp */}
        {avgWaterTempF !== null && (
          <p className="text-xs mt-1" style={{ color: '#0e7490' }}>
            🌊 {avgWaterTempF}°F
          </p>
        )}

        {/* Rain chance */}
        {day.maxPrecipProb !== null && day.maxPrecipProb >= 20 && (
          <p className="text-xs mt-1 font-medium" style={{ color: '#1b7fcb' }}>
            💧 {day.maxPrecipProb}%
          </p>
        )}
      </div>
    </button>
  )
}
