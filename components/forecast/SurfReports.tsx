'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import type { LiveConditionReport } from '@/app/api/surf-reports/[spotSlug]/route'
import { WaveLoader } from '@/components/layout/WaveLoader'
import { Icon } from '@/components/ui/Icon'

const TREND_ICON: Record<string, string> = {
  rising: '↑',
  dropping: '↓',
  steady: '→',
  unknown: '—',
}
const TREND_COLOR: Record<string, string> = {
  rising: '#16a34a',
  dropping: '#ef4444',
  steady: '#6b7280',
  unknown: '#9ca3af',
}

function StatCard({ label, value, unit, sub }: { label: string; value: string | null; unit?: string; sub?: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}
    >
      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>{label}</div>
      {value != null ? (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
              {value}
            </span>
            {unit && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{unit}</span>}
          </div>
          {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</div>}
        </>
      ) : (
        <div className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>—</div>
      )}
    </div>
  )
}

export function SurfReports({ spotSlug }: { spotSlug: string }) {
  const { data, isLoading } = useQuery<{ report: LiveConditionReport }>({
    queryKey: ['surf-reports', spotSlug],
    queryFn: async () => {
      const r = await fetch(`/api/surf-reports/${spotSlug}`, { signal: AbortSignal.timeout(10000) })
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json()
    },
    staleTime: 30 * 60 * 1000,
  })

  const report = data?.report

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--sand-50)' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Live Conditions</h3>
          {report?.stationName && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{report.stationName}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* NOAA badge */}
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: 'rgba(27,127,203,0.1)', color: 'var(--ocean-700)', border: '1px solid rgba(27,127,203,0.2)' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            NOAA NDBC
          </div>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <WaveLoader compact label="Checking buoy…" />
        ) : !report || report.source === 'none' ? (
          <div className="py-6 text-center">
            <div className="mb-2 flex justify-center" style={{ color: 'var(--text-3)' }}><Icon name="buoy" size={36} strokeWidth={1.4} /></div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>No buoy nearby</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {report?.summary ?? 'No live buoy data available. Check the forecast charts.'}
            </p>
          </div>
        ) : (
          <>
            {/* Trend banner */}
            {report.trend !== 'unknown' && report.waveHeight != null && (
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 mb-4"
                style={{ background: `${TREND_COLOR[report.trend]}15`, border: `1px solid ${TREND_COLOR[report.trend]}30` }}
              >
                <span style={{ fontSize: '18px', fontWeight: 800, color: TREND_COLOR[report.trend] }}>
                  {TREND_ICON[report.trend]}
                </span>
                <div>
                  <span className="text-xs font-semibold" style={{ color: TREND_COLOR[report.trend] }}>
                    Swell {report.trend === 'rising' ? 'Building' : report.trend === 'dropping' ? 'Fading' : 'Holding Steady'}
                  </span>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>vs 6 hours ago</p>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatCard
                label="Wave Height"
                value={report.waveHeight != null ? `${report.waveHeight.toFixed(1)}m` : null}
                unit={report.waveHeight != null ? `(${Math.round(report.waveHeight * 3.281)}ft)` : undefined}
              />
              <StatCard
                label="Dominant Period"
                value={report.dominantPeriod != null ? `${Math.round(report.dominantPeriod)}s` : null}
              />
              <StatCard
                label="Wave Power"
                value={report.wavePower != null ? `${report.wavePower}` : null}
                unit="kW/m"
                sub={report.wavePower != null
                  ? report.wavePower < 5 ? 'Low energy'
                  : report.wavePower < 20 ? 'Moderate energy'
                  : report.wavePower < 50 ? 'High energy'
                  : 'Extreme energy'
                  : undefined}
              />
              <StatCard
                label="Wind"
                value={report.windSpeed != null ? `${Math.round(report.windSpeed * 0.621371)} mph` : null}
                sub={report.windDirection ?? undefined}
              />
              {report.swellDirection && (
                <StatCard label="Swell Direction" value={report.swellDirection} />
              )}
              {report.waterTemp != null && (
                <StatCard
                  label="Water Temp"
                  value={`${Math.round(report.waterTemp * 9/5 + 32)}°F`}
                />
              )}
            </div>

            {/* Summary text */}
            <div
              className="rounded-xl px-4 py-3 mb-3"
              style={{ background: 'var(--ocean-50)', border: '1px solid var(--ocean-100)' }}
            >
              <p className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--ocean-700)' }}><Icon name="pin" size={12} strokeWidth={1.6} /> Station Report</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{report.summary}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Updated {formatDistanceToNow(parseISO(report.time), { addSuffix: true })}
              </p>
              {report.detailUrl && (
                <a
                  href={report.detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium hover:underline"
                  style={{ color: 'var(--ocean-600)' }}
                >
                  Full NOAA data →
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
