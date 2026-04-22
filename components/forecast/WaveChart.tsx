'use client'

import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { ForecastDay } from '@/types/forecast'
import { format, parseISO } from 'date-fns'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtHeightDec } from '@/lib/units'

interface Props {
  days: ForecastDay[]
  activeDayData?: ForecastDay
}

export function WaveChart({ days, activeDayData }: Props) {
  const [mode, setMode] = useState<'7day' | 'daily'>('daily')
  const { unit } = useUnits()

  const sevenDayData = days.flatMap((day) =>
    day.hours
      .filter((_, i) => i % 3 === 0)
      .map((h) => ({
        time: h.time,
        waveHeight: Math.round(h.waveHeight * 10) / 10,
        swellHeight: Math.round(h.swellHeight * 10) / 10,
        label: format(parseISO(h.time), 'EEE ha'),
      }))
  )

  const dailyData = activeDayData
    ? activeDayData.hours.map((h) => ({
        time: h.time,
        waveHeight: Math.round(h.waveHeight * 10) / 10,
        swellHeight: Math.round(h.swellHeight * 10) / 10,
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

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#1b7fcb" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#1b7fcb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="swellGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              tickFormatter={(v) => fmtHeightDec(v, unit)}
              width={34}
            />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: '1px solid #ede0cc',
                borderRadius: '10px',
                fontSize: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}
              labelStyle={{ color: '#4a4a6a', marginBottom: '4px' }}
              formatter={(value, name) => [
                fmtHeightDec(value as number, unit),
                name === 'waveHeight' ? 'Wave' : 'Swell',
              ]}
            />
            <Area type="monotone" dataKey="swellHeight" stroke="#7c3aed" strokeWidth={1.5} fill="url(#swellGrad)" />
            <Area type="monotone" dataKey="waveHeight"  stroke="#1b7fcb" strokeWidth={2}   fill="url(#waveGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
