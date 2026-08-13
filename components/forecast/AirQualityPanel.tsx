'use client'

import { useQuery } from '@tanstack/react-query'
import type { CurrentAirQuality } from '@/lib/api/open-meteo-air'
import { Icon } from '@/components/ui/Icon'

interface Props { spotSlug: string }

const AQI_SEGMENTS = [
  { max: 50,  label: 'Good',      color: '#16a34a' },
  { max: 100, label: 'Moderate',  color: '#d97706' },
  { max: 150, label: 'Sensitive', color: '#f97316' },
  { max: 200, label: 'Unhealthy', color: '#dc2626' },
  { max: 300, label: 'V.Unhlthy', color: '#7c3aed' },
  { max: 500, label: 'Hazardous', color: '#7f1d1d' },
]

function gaugePos(aqi: number): number {
  const clamped = Math.min(aqi, 500)
  return (Math.log(clamped + 1) / Math.log(501)) * 100
}

function MetricPill({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value === null) return null
  return (
    <div
      className="flex flex-col items-center rounded-xl px-3 py-2"
      style={{ background: 'var(--sand-50)', border: '1px solid var(--border)', minWidth: 64 }}
    >
      <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="font-bold text-sm mt-0.5" style={{ color: 'var(--text)' }}>
        {Math.round(value)}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{unit}</span>
    </div>
  )
}

export function AirQualityPanel({ spotSlug }: Props) {
  const { data, isLoading } = useQuery<CurrentAirQuality>({
    queryKey: ['air-quality', spotSlug],
    queryFn: () => fetch(`/api/air-quality/${spotSlug}`).then((r) => {
      if (!r.ok) throw new Error('aq-unavailable')
      return r.json()
    }),
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="rounded-2xl p-5 animate-pulse" style={{ background: 'white', border: '1px solid var(--border)', minHeight: 120 }} />
    )
  }
  if (!data) return null

  const aqi = data.usAqi
  const segWidths = AQI_SEGMENTS.map((s, i) => {
    const start = i === 0 ? 0 : AQI_SEGMENTS[i - 1].max
    return gaugePos(s.max) - gaugePos(start)
  })
  const pos = aqi !== null ? gaugePos(aqi) : 0

  return (
    <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="wind" size={18} style={{ color: 'var(--text-3)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Air Quality</span>
        </div>
        {aqi !== null && (
          <span
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: data.bg, color: data.color, border: `1px solid ${data.color}30` }}
          >
            {data.label}
          </span>
        )}
      </div>

      {/* AQI number */}
      {aqi !== null && (
        <div className="flex items-baseline gap-2 mb-4">
          <span
            style={{
              fontSize: 40,
              fontWeight: 800,
              lineHeight: 1,
              fontFamily: 'Playfair Display, serif',
              color: data.color,
            }}
          >
            {aqi}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-3)' }}>US AQI</span>
        </div>
      )}

      {/* Gradient gauge */}
      {aqi !== null && (
        <div className="mb-3">
          <div
            className="relative h-4 rounded-full overflow-hidden flex"
            style={{ border: '1px solid var(--border)' }}
          >
            {segWidths.map((w, i) => (
              <div key={i} style={{ width: `${w}%`, background: AQI_SEGMENTS[i].color, opacity: 0.85 }} />
            ))}
            <div
              className="absolute top-0 bottom-0 w-0.5 rounded"
              style={{
                left: `${pos}%`,
                background: 'white',
                boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
                transform: 'translateX(-50%)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1 px-0.5">
            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>0 · Good</span>
            <span style={{ fontSize: 9, color: 'var(--text-3)' }}>500 · Hazardous</span>
          </div>
        </div>
      )}

      {/* Particulate metrics */}
      <div className="flex flex-wrap gap-2 mt-4">
        <MetricPill label="PM2.5" value={data.pm25} unit="μg/m³" />
        <MetricPill label="PM10"  value={data.pm10}  unit="μg/m³" />
        {data.dust !== null && data.dust > 0 && (
          <MetricPill label="Dust" value={data.dust} unit="μg/m³" />
        )}
        {data.europeanAqi !== null && (
          <MetricPill label="EU AQI" value={data.europeanAqi} unit="" />
        )}
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>
        Source: Open-Meteo Air Quality API
      </p>
    </div>
  )
}
