'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { ForecastDay } from '@/types/forecast'
import { format, parseISO } from 'date-fns'
import { degreesToCompass } from '@/lib/forecast/rating'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtWind } from '@/lib/units'

interface Props {
  days: ForecastDay[]
  activeDayData?: ForecastDay
}

function getWindColor(speed: number | null): string {
  if (speed == null) return '#d4d4d8'
  if (speed < 10) return '#16a34a'
  if (speed < 20) return '#f59e0b'
  if (speed < 30) return '#f97316'
  return '#ef4444'
}

export function WindChart({ days, activeDayData }: Props) {
  const [mode, setMode] = useState<'7day' | 'daily'>('daily')
  const { unit } = useUnits()

  // 7-day window anchored at the selected day so the chart matches the
  // 16-day strip's currently-active day instead of always starting on day 0.
  const anchorIdx = activeDayData ? days.findIndex((d) => d.date === activeDayData.date) : 0
  const startIdx = Math.max(0, Math.min(anchorIdx, days.length - 7))
  const sevenDayWindow = days.slice(startIdx, startIdx + 7)

  const sevenDayData = sevenDayWindow.flatMap((day) =>
    day.hours
      .filter((_, i) => i % 3 === 0)
      .map((h) => ({
        // null = wind unknown for the hour; recharts leaves a gap for null bars
        speed: h.wind.speed == null ? null : Math.round(h.wind.speed),
        dir: degreesToCompass(h.wind.direction),
        label: format(parseISO(h.time), 'EEE ha'),
      }))
  )

  const dailyData = activeDayData
    ? activeDayData.hours.map((h) => ({
        speed: h.wind.speed == null ? null : Math.round(h.wind.speed),
        dir: degreesToCompass(h.wind.direction),
        label: format(parseISO(h.time), 'ha'),
      }))
    : []

  const data = mode === 'daily' && activeDayData ? dailyData : sevenDayData

  return (
    <div>
      {/* Toggle */}
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

      {/* Chart */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ede0cc" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#8888aa', fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={36}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: '#8888aa', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => fmtWind(v, unit)}
              width={40}
            />
            <Tooltip
              contentStyle={{ background: 'white', border: '1px solid #ede0cc', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
              labelStyle={{ color: '#4a4a6a', marginBottom: '4px' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const item = data.find((d) => d.label === label)
                return (
                  <div className="rounded-xl p-3 text-xs shadow-lg" style={{ background: 'white', border: '1px solid #ede0cc' }}>
                    <p className="mb-1 font-medium" style={{ color: '#4a4a6a' }}>{label}</p>
                    <p style={{ color: '#1a1a2e' }}>
                      {payload[0]?.value == null ? '—' : `${fmtWind(payload[0].value as number, unit)} ${item?.dir ?? ''}`}
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="speed" radius={[3, 3, 0, 0]}>
              {data.map((entry, i) => <Cell key={i} fill={getWindColor(entry.speed)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
