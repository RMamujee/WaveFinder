'use client'

import { useQuery } from '@tanstack/react-query'
import type { MonthlyClimate } from '@/lib/api/nasa-power'
import { Icon } from '@/components/ui/Icon'

interface Props { spotSlug: string }

function tempF(c: number) { return Math.round(c * 9 / 5 + 32) }
function mphFromMs(ms: number) { return Math.round(ms * 2.237) }

export function SeasonalClimatePanel({ spotSlug }: Props) {
  const { data, isLoading } = useQuery<{ climate: MonthlyClimate[] }>({
    queryKey: ['seasonal', spotSlug],
    queryFn: () => fetch(`/api/seasonal/${spotSlug}`).then((r) => {
      if (!r.ok) throw new Error('seasonal-unavailable')
      return r.json()
    }),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })

  if (isLoading || !data?.climate?.length) return null

  const months = data.climate
  // POWER can report -999/no-data for individual months (stored as null) —
  // aggregate over the months that have values and render gaps for the rest.
  const winds = months.map((m) => m.avgWindSpeedMs).filter((v): v is number => v != null)
  const temps = months.map((m) => m.avgTempC).filter((v): v is number => v != null)
  const precips = months.map((m) => m.avgPrecipMmDay).filter((v): v is number => v != null)
  if (!winds.length && !temps.length && !precips.length) return null
  const maxWind = Math.max(...(winds.length ? winds : [1]), 0.1)
  const maxPrecip = Math.max(...(precips.length ? precips : [1]), 1)
  const maxTemp = temps.length ? Math.max(...temps) : 0
  const minTemp = temps.length ? Math.min(...temps) : 0
  const tempRange = Math.max(maxTemp - minTemp, 1)

  const currentMonth = new Date().getMonth() + 1

  return (
    <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon name="calendar" size={18} style={{ color: 'var(--text-3)' }} />
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          Seasonal Climate
        </span>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>20-yr avg · NASA POWER</span>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-12 gap-0.5 mb-2">
        {months.map((m) => {
          const isNow = m.month === currentMonth
          const windH = m.avgWindSpeedMs == null ? null : Math.round((m.avgWindSpeedMs / maxWind) * 40)
          const tempNorm = m.avgTempC == null ? null : (m.avgTempC - minTemp) / tempRange

          return (
            <div key={m.month} className="flex flex-col items-center gap-0.5">
              {/* Wind bar (flat grey stub when the month has no data) */}
              <div
                className="w-full rounded-sm"
                style={{
                  height: windH == null ? 2 : windH || 2,
                  background: windH == null ? 'var(--border)' : isNow ? 'var(--ocean-600)' : '#93c5fd',
                  alignSelf: 'flex-end',
                  opacity: isNow ? 1 : 0.7,
                }}
                title={m.avgWindSpeedMs == null ? 'Wind: no data' : `Wind: ${mphFromMs(m.avgWindSpeedMs)} mph`}
              />
              {/* Precip dot */}
              <div
                className="rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  background: m.avgPrecipMmDay == null
                    ? 'var(--border)'
                    : `rgba(59,130,246,${(m.avgPrecipMmDay / maxPrecip).toFixed(2)})`,
                }}
                title={m.avgPrecipMmDay == null ? 'Rain: no data' : `Rain: ${m.avgPrecipMmDay.toFixed(1)} mm/day`}
              />
              {/* Temp color strip */}
              <div
                className="w-full h-1 rounded-sm"
                style={{
                  background: tempNorm == null ? 'var(--border)' : `hsl(${200 - Math.round(tempNorm * 160)},70%,55%)`,
                  opacity: isNow ? 1 : 0.65,
                }}
                title={m.avgTempC == null ? 'Temp: no data' : `Temp: ${tempF(m.avgTempC)}°F`}
              />
              <span
                style={{
                  fontSize: 9,
                  fontWeight: isNow ? 700 : 400,
                  color: isNow ? 'var(--ocean-600)' : 'var(--text-3)',
                }}
              >
                {m.name[0]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-4 rounded-sm" style={{ background: '#93c5fd' }} />
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Avg wind</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="rounded-full w-2 h-2" style={{ background: '#3b82f6' }} />
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Precipitation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-4 rounded-sm" style={{ background: 'linear-gradient(90deg, #3b82f6, #ef4444)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Avg temp</span>
        </div>
      </div>

      {/* Monthly detail for current month */}
      {(() => {
        const cur = months[currentMonth - 1]
        if (!cur) return null
        return (
          <div
            className="mt-4 rounded-xl px-4 py-3 flex flex-wrap gap-4"
            style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}
          >
            <div>
              <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Avg wind ({cur.name})</p>
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                {cur.avgWindSpeedMs == null ? '—' : `${mphFromMs(cur.avgWindSpeedMs)} mph`}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Avg temp</p>
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                {cur.avgTempC == null ? '—' : `${tempF(cur.avgTempC)}°F`}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Avg rain</p>
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                {cur.avgPrecipMmDay == null ? '—' : `${cur.avgPrecipMmDay.toFixed(1)} mm/day`}
              </p>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
