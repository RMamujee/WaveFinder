'use client'

import { getSpotSeasons } from '@/lib/spot-seasons'
import type { MonthData } from '@/lib/spot-seasons'

interface Props {
  region: string
  difficulty: string
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const QUALITY_STYLES: Record<MonthData['quality'], { bg: string; text: string; border: string; label: string }> = {
  poor: {
    bg: '#f3f4f6',
    text: '#6b7280',
    border: '#e5e7eb',
    label: 'Poor',
  },
  fair: {
    bg: '#fffbeb',
    text: '#92400e',
    border: '#fde68a',
    label: 'Fair',
  },
  good: {
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#bbf7d0',
    label: 'Good',
  },
  epic: {
    bg: '#f5f3ff',
    text: '#6d28d9',
    border: '#ddd6fe',
    label: 'Epic',
  },
}

export function SeasonCalendar({ region, difficulty }: Props) {
  const seasons = getSpotSeasons(region, difficulty)
  const currentMonth = new Date().getMonth() + 1 // 1-12

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="mb-4">
        <h3
          className="text-sm font-semibold mb-0.5"
          style={{ color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}
        >
          Surf Season Calendar
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          {seasons.swellSource}
        </p>
      </div>

      {/* 12-month grid: 4 cols × 3 rows on mobile, 12 cols on desktop */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12 mb-5">
        {seasons.months.map((m) => {
          const style = QUALITY_STYLES[m.quality]
          const isCurrent = m.month === currentMonth
          return (
            <div
              key={m.month}
              title={m.label}
              className="flex flex-col items-center rounded-xl py-2 px-1 cursor-default transition-transform hover:scale-105"
              style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
                outline: isCurrent ? `2px solid var(--ocean-500)` : undefined,
                outlineOffset: isCurrent ? '2px' : undefined,
              }}
            >
              <span
                className="text-xs font-semibold"
                style={{ color: style.text }}
              >
                {MONTH_NAMES[m.month - 1]}
              </span>
              <span
                className="mt-1 text-xs font-bold uppercase tracking-tight"
                style={{ color: style.text, fontSize: '9px', letterSpacing: '0.04em' }}
              >
                {style.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mb-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        {(Object.entries(QUALITY_STYLES) as [MonthData['quality'], typeof QUALITY_STYLES[MonthData['quality']]][]).map(
          ([key, style]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-full"
                style={{ background: style.bg, border: `2px solid ${style.border}` }}
              />
              <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                {style.label}
              </span>
            </div>
          )
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <div
            className="h-3 w-3 rounded-full"
            style={{ background: 'transparent', border: '2px solid var(--ocean-500)', outline: '1px solid var(--ocean-500)', outlineOffset: '1px' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>Current month</span>
        </div>
      </div>

      {/* Season info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>
            Peak Season
          </p>
          <p className="text-sm font-semibold" style={{ color: '#15803d' }}>
            {seasons.peakSeason}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>
            Off Season
          </p>
          <p className="text-sm font-semibold" style={{ color: '#6b7280' }}>
            {seasons.offSeason}
          </p>
        </div>
      </div>

      {/* Notes */}
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
        {seasons.notes}
      </p>
    </div>
  )
}
