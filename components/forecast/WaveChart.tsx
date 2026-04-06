'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { ForecastDay } from '@/types/forecast'
import { format, parseISO } from 'date-fns'

interface Props { days: ForecastDay[] }

export function WaveChart({ days }: Props) {
  const data = days.flatMap((day) =>
    day.hours
      .filter((_, i) => i % 3 === 0)
      .map((h) => ({
        time: h.time,
        waveHeight: Math.round(h.waveHeight * 10) / 10,
        swellHeight: Math.round(h.swellHeight * 10) / 10,
        label: format(parseISO(h.time), 'EEE ha'),
      }))
  )

  return (
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
          <CartesianGrid strokeDasharray="3 3" stroke="#ede0cc" />
          <XAxis dataKey="label" tick={{ fill: '#8888aa', fontSize: 10 }} interval={7} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: '#8888aa', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}m`} width={34} />
          <Tooltip
            contentStyle={{ background: 'white', border: '1px solid #ede0cc', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
            labelStyle={{ color: '#4a4a6a', marginBottom: '4px' }}
            formatter={(value, name) => [`${value}m`, name === 'waveHeight' ? 'Wave' : 'Swell']}
          />
          <Area type="monotone" dataKey="swellHeight" stroke="#7c3aed" strokeWidth={1.5} fill="url(#swellGrad)" />
          <Area type="monotone" dataKey="waveHeight"  stroke="#1b7fcb" strokeWidth={2}   fill="url(#waveGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
