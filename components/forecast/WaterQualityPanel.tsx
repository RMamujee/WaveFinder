'use client'

import { useQuery } from '@tanstack/react-query'
import type { WaterQualityResponse } from '@/app/api/water-quality/[slug]/route'
import { formatDistanceToNow, parseISO } from 'date-fns'

interface Props {
  spotSlug: string
}

// ── Thresholds (EPA recreational water quality standard) ──────────────────────
const THRESHOLDS = [
  { max: 35,  label: 'Safe',    color: '#16a34a', bg: '#f0fdf4', border: '#86efac', desc: 'Meets EPA standard for safe swimming' },
  { max: 100, label: 'Caution', color: '#d97706', bg: '#fffbeb', border: '#fde68a', desc: 'Elevated bacteria levels — exercise caution' },
  { max: 200, label: 'Unsafe',  color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', desc: 'High bacterial levels — avoid swimming' },
  { max: Infinity, label: 'Closed', color: '#7f1d1d', bg: '#fff1f2', border: '#fda4af', desc: 'Beach may be closed — do not swim' },
]

function getThreshold(value: number) {
  return THRESHOLDS.find(t => value <= t.max) ?? THRESHOLDS[THRESHOLDS.length - 1]
}

// Log scale position (0–100%) for gauge marker
// Maps 0→500+ CFU onto the bar using log scale for readability
function gaugePosition(value: number): number {
  const clamped = Math.min(value, 500)
  // log(1) = 0, log(501) = max → normalize
  return (Math.log(clamped + 1) / Math.log(501)) * 100
}

// Mini sparkline dot color
function dotColor(value: number) {
  return getThreshold(value).color
}

export function WaterQualityPanel({ spotSlug }: Props) {
  const { data, isLoading } = useQuery<WaterQualityResponse>({
    queryKey: ['water-quality', spotSlug],
    queryFn: () => fetch(`/api/water-quality/${spotSlug}`).then(r => r.json()),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  })

  // While loading, render nothing — section won't flash in then disappear
  if (isLoading) return null

  // No data → hide the entire section (parent renders nothing)
  if (!data || data.source === 'none' || data.status === 'no_data' || !data.latestReading) return null

  const { latestReading, history, beachName } = data
  const threshold = getThreshold(latestReading.value)
  const pos = gaugePosition(latestReading.value)
  const testedAgo = formatDistanceToNow(parseISO(latestReading.date), { addSuffix: true })

  // Gauge segment widths (log-proportional to threshold boundaries)
  const segments = [
    { label: 'Safe', color: '#16a34a', end: 35 },
    { label: 'Caution', color: '#d97706', end: 100 },
    { label: 'Unsafe', color: '#dc2626', end: 200 },
    { label: 'Closed', color: '#7f1d1d', end: 500 },
  ]
  const segWidths = segments.map((s, i) => {
    const start = i === 0 ? 0 : segments[i - 1].end
    return gaugePosition(s.end) - gaugePosition(start)
  })

  return (
    <div>
      <h2
        className="mb-2 font-semibold text-sm"
        style={{ color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.03em', textTransform: 'uppercase' }}
      >
        Water Quality
      </h2>
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>🧫</span>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              {beachName ?? 'Bacterial Monitoring'}
            </h3>
          </div>
          {beachName && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Nearest BEACH station · ~20 mi radius
            </p>
          )}
        </div>
        {/* Status badge */}
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: threshold.bg, color: threshold.color, border: `1px solid ${threshold.border}` }}
        >
          {threshold.label}
        </span>
      </div>

      {/* Big reading */}
      <div className="flex items-baseline gap-2 mb-4">
        <span
          style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, fontFamily: 'Playfair Display, serif', color: threshold.color }}
        >
          {latestReading.value < 1 ? '<1' : Math.round(latestReading.value)}
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>cfu/100mL enterococcus</span>
      </div>

      {/* AQI-style gradient gauge */}
      <div className="mb-1">
        <div className="relative h-5 rounded-full overflow-hidden flex" style={{ border: '1px solid var(--border)' }}>
          {segWidths.map((w, i) => (
            <div key={i} style={{ width: `${w}%`, background: segments[i].color, opacity: 0.85 }} />
          ))}
          {/* Needle marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 rounded"
            style={{
              left: `${pos}%`,
              background: 'var(--surface)',
              boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
        {/* Scale labels */}
        <div className="flex justify-between mt-1">
          {segments.map((s, i) => (
            <div key={i} style={{ width: `${segWidths[i]}%` }} className="text-center">
              <span className="text-xs font-medium" style={{ color: s.color, fontSize: '10px' }}>
                {s.label}
              </span>
              <span className="block" style={{ color: 'var(--text-3)', fontSize: '10px' }}>
                ≤{s.end}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs mt-3 mb-4" style={{ color: 'var(--text-2)' }}>
        {threshold.desc}. EPA safe swimming standard is ≤35 cfu/100mL.
      </p>

      {/* History sparkline */}
      {history.length > 1 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-3)' }}>
            Recent readings ({history.length} samples)
          </p>
          <div className="flex items-end gap-1.5" style={{ height: 48 }}>
            {history.slice(0, 10).reverse().map((r, i) => {
              const maxVal = Math.max(...history.map(h => h.value), 50)
              const barH = Math.max(4, (r.value / maxVal) * 44)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${r.date}: ${Math.round(r.value)} cfu/100mL`}>
                  <div
                    className="w-full rounded-sm"
                    style={{ height: barH, background: dotColor(r.value), opacity: 0.85 }}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: 'var(--text-3)', fontSize: '10px' }}>
              {history[history.length - 1]?.date}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-3)', fontSize: '10px' }}>
              {history[0]?.date}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          Sampled {testedAgo}
        </p>
        <a
          href="https://www.waterqualitydata.us"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs"
          style={{ color: 'var(--ocean-600)' }}
        >
          Source: USGS/EPA BEACH Program
        </a>
      </div>
    </div>
    </div>
  )
}
