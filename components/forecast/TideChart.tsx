'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot,
} from 'recharts'
import type { TidePoint } from '@/types/forecast'
import { format, parseISO } from 'date-fns'

interface Props {
  tides: TidePoint[]
  selectedDate?: string
}

export function TideChart({ tides, selectedDate }: Props) {
  const [mode, setMode] = useState<'7day' | 'daily'>('7day')

  if (!tides.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>
        Tide data not available for this location
      </div>
    )
  }

  const filteredTides =
    mode === 'daily' && selectedDate
      ? tides.filter((t) => t.time.startsWith(selectedDate))
      : tides

  const data = filteredTides.map((t) => ({
    time: t.time,
    height: Math.round(t.height * 100) / 100,
    type: t.type,
    label: format(parseISO(t.time), 'EEE ha'),
  }))

  return (
    <div>
      {/* Toggle — only show if selectedDate is provided */}
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

      {/* Chart */}
      <div className="h-40">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>
            No tide data for this day
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ede0cc" />
              <XAxis dataKey="label" tick={{ fill: '#8888aa', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#8888aa', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}m`} width={34} />
              <Tooltip
                contentStyle={{ background: 'white', border: '1px solid #ede0cc', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                formatter={(value, _name, props) => [
                  `${value}m ${(props as { payload?: { type?: string } }).payload?.type === 'H' ? '(High)' : '(Low)'}`,
                  'Tide',
                ]}
              />
              <Line type="monotone" dataKey="height" stroke="#1b7fcb" strokeWidth={2} dot={false} />
              {data.map((d, i) =>
                d.type ? (
                  <ReferenceDot
                    key={i}
                    x={d.label}
                    y={d.height}
                    r={4}
                    fill={d.type === 'H' ? '#1b7fcb' : '#c9a87c'}
                    stroke="white"
                    strokeWidth={1.5}
                    label={{
                      value: `${d.type} ${d.height}m`,
                      position: d.type === 'H' ? 'top' : 'bottom',
                      fill: '#8888aa',
                      fontSize: 10,
                    }}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
