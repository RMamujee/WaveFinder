'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { ForecastDay } from '@/types/forecast'
import { format, parseISO } from 'date-fns'

interface Props {
  activeDayData: ForecastDay
}

function uvColor(uv: number): string {
  if (uv <= 2) return '#16a34a'
  if (uv <= 5) return '#f59e0b'
  if (uv <= 7) return '#f97316'
  if (uv <= 10) return '#ef4444'
  return '#7c3aed'
}

function uvLabel(uv: number): string {
  if (uv <= 2) return 'Low'
  if (uv <= 5) return 'Moderate'
  if (uv <= 7) return 'High'
  if (uv <= 10) return 'Very High'
  return 'Extreme'
}

// Custom dot colored by UV level
function UVDot(props: {
  cx?: number; cy?: number; value?: number; index?: number; dataLength?: number
}) {
  const { cx, cy, value } = props
  if (cx == null || cy == null || value == null) return null
  // Only draw peak dot
  return (
    <circle
      cx={cx} cy={cy} r={3}
      fill={uvColor(value)}
      stroke="white" strokeWidth={1.5}
    />
  )
}

export function UVChart({ activeDayData }: Props) {
  const data = activeDayData.hours.map((h) => ({
    label: format(parseISO(h.time), 'ha'),
    uv: Math.round(h.uvIndex * 10) / 10,
  }))

  const peakUV = Math.max(...data.map((d) => d.uv))
  const peakEntry = data.find((d) => d.uv === peakUV)

  // Threshold reference lines
  const thresholds = [
    { value: 3,  label: 'Moderate', color: '#f59e0b' },
    { value: 6,  label: 'High',     color: '#f97316' },
    { value: 8,  label: 'V.High',   color: '#ef4444' },
    { value: 11, label: 'Extreme',  color: '#7c3aed' },
  ].filter((t) => t.value <= peakUV + 2)

  const yMax = Math.max(12, Math.ceil(peakUV) + 1)

  return (
    <div>
      {/* Peak badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{
              background: peakUV <= 2 ? '#f0fdf4' : peakUV <= 5 ? '#fffbeb' : peakUV <= 7 ? '#fff7ed' : peakUV <= 10 ? '#fef2f2' : '#f5f3ff',
              color: uvColor(peakUV),
            }}
          >
            Peak {peakUV} — {uvLabel(peakUV)}
          </span>
          {peakEntry && (
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              around {peakEntry.label}
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>UV Index</span>
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="uvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#7c3aed" stopOpacity={0.22} />
                <stop offset="30%"  stopColor="#ef4444" stopOpacity={0.16} />
                <stop offset="60%"  stopColor="#f59e0b" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.04} />
              </linearGradient>
              {/* Colored stroke gradient */}
              <linearGradient id="uvStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#7c3aed" />
                <stop offset="35%"  stopColor="#ef4444" />
                <stop offset="65%"  stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#ede0cc" vertical={false} />

            {thresholds.map((t) => (
              <ReferenceLine
                key={t.value}
                y={t.value}
                stroke={t.color}
                strokeDasharray="4 3"
                strokeOpacity={0.5}
                label={{
                  value: t.label,
                  position: 'insideTopLeft',
                  fill: t.color,
                  fontSize: 9,
                  fontWeight: 600,
                  dx: 4,
                }}
              />
            ))}

            <XAxis
              dataKey="label"
              tick={{ fill: '#8888aa', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={36}
            />
            <YAxis
              tick={{ fill: '#8888aa', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              domain={[0, yMax]}
              width={24}
            />

            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                fontSize: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}
              labelStyle={{ color: 'var(--text-2)', marginBottom: '4px' }}
              formatter={(value) => {
                const uv = Number(value ?? 0)
                return [`${uv} — ${uvLabel(uv)}`, 'UV Index']
              }}
            />

            <Area
              type="monotone"
              dataKey="uv"
              stroke="url(#uvStroke)"
              strokeWidth={2.5}
              fill="url(#uvGrad)"
              dot={<UVDot />}
              activeDot={{ r: 5, fill: '#f59e0b', stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
