'use client'

import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot,
} from 'recharts'
import type { TidePoint } from '@/types/forecast'
import { format, parseISO } from 'date-fns'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtTide } from '@/lib/units'

interface Props {
  tides: TidePoint[]
  selectedDate?: string  // "YYYY-MM-DD" from forecast activeDayData
}

export function TideChart({ tides, selectedDate }: Props) {
  const [mode, setMode] = useState<'7day' | 'daily'>('daily')
  const { unit } = useUnits()

  if (!tides.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>
        Tide data not available for this location
      </div>
    )
  }

  // Tide times are stored as local "YYYY-MM-DDTHH:MM" (Pacific time from NOAA).
  // selectedDate is also in local format from the forecast grouping — safe to compare.
  const dailyTides = selectedDate ? tides.filter((t) => t.time.startsWith(selectedDate)) : tides

  // 7-day window anchored at the selected day. NOAA returns up to 17 days of
  // hourly predictions — slice 7 of them centred on the selection so the chart
  // matches the 16-day strip's currently-active day.
  const sevenDayWindow = (() => {
    if (!selectedDate) return tides
    const startMs = new Date(`${selectedDate}T00:00`).getTime()
    const endMs = startMs + 7 * 24 * 60 * 60 * 1000
    return tides.filter((t) => {
      const tMs = new Date(t.time).getTime()
      return tMs >= startMs && tMs < endMs
    })
  })()

  const filteredTides = mode === 'daily' ? dailyTides : sevenDayWindow

  // For 7-day view, thin to every 2nd point so the x-axis isn't overcrowded
  const displayTides =
    mode === '7day'
      ? filteredTides.filter((_, i) => i % 2 === 0)
      : filteredTides

  const data = displayTides.map((t) => ({
    time:   t.time,
    height: t.height,
    type:   t.type ?? null,
    label:  format(parseISO(t.time), mode === 'daily' ? 'ha' : 'EEE ha'),
  }))

  // H/L annotation points
  const hlPoints = data.filter((d) => d.type !== null)


  return (
    <div>
      {/* Toggle */}
      {selectedDate && (
        <div className="flex justify-end mb-3">
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--sand-100)' }}
          >
            {(['7day', 'daily'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  background: mode === m ? 'white' : 'transparent',
                  color: mode === m ? 'var(--ocean-600)' : 'var(--text-3)',
                  fontWeight: mode === m ? 600 : 400,
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {m === '7day' ? '7 Day' : 'Daily'}
              </button>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>
          No tide data for this day
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1b7fcb" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#1b7fcb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ede0cc" vertical={false} />
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
                tickFormatter={(v) => fmtTide(v, unit)}
                width={34}
              />
              <Tooltip
                contentStyle={{
                  background: 'white', border: '1px solid #ede0cc',
                  borderRadius: '10px', fontSize: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                }}
                formatter={(value, _name, props) => {
                  const t = (props as { payload?: { type?: string | null } }).payload?.type
                  const label = t === 'H' ? ' — High' : t === 'L' ? ' — Low' : ''
                  return [`${fmtTide(value as number, unit)}${label}`, 'Tide']
                }}
                labelStyle={{ color: '#4a4a6a', marginBottom: '4px' }}
              />
              <Area
                type="monotone"
                dataKey="height"
                stroke="#1b7fcb"
                strokeWidth={2}
                fill="url(#tideGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#1b7fcb', stroke: 'white', strokeWidth: 2 }}
              />
              {hlPoints.map((d, i) => (
                <ReferenceDot
                  key={i}
                  x={d.label}
                  y={d.height}
                  r={4}
                  fill={d.type === 'H' ? '#1b7fcb' : '#c9a87c'}
                  stroke="white"
                  strokeWidth={1.5}
                  label={{
                    value: `${d.type === 'H' ? 'H' : d.type === 'L' ? 'L' : 'N/A'} ${fmtTide(d.height, unit)}`,
                    position: d.type === 'H' ? 'top' : 'bottom',
                    fill: '#8888aa',
                    fontSize: 10,
                  }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
