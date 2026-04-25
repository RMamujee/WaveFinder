'use client'

import { useState } from 'react'
import type { NWSAlert, AlertSeverity } from '@/lib/api/noaa-alerts'
import { format, parseISO } from 'date-fns'

interface Props {
  alerts: NWSAlert[]
}

const SEVERITY_STYLE: Record<AlertSeverity, { bg: string; border: string; text: string; dot: string; label: string }> = {
  Extreme: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', dot: '#ef4444', label: 'Extreme' },
  Severe:  { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', dot: '#f97316', label: 'Warning' },
  Moderate:{ bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#f59e0b', label: 'Watch' },
  Minor:   { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', dot: '#3b82f6', label: 'Advisory' },
  Unknown: { bg: '#f9fafb', border: '#e5e7eb', text: '#374151', dot: '#9ca3af', label: 'Statement' },
}

function fmtExpires(iso: string): string {
  try {
    return format(parseISO(iso), 'EEE h:mm a')
  } catch {
    return ''
  }
}

export function StormAlerts({ alerts }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!alerts.length) return null

  return (
    <div className="mx-auto max-w-7xl px-5 pt-3">
      <div className="flex flex-col gap-2">
        {alerts.map((alert) => {
          const s = SEVERITY_STYLE[alert.severity]
          const isOpen = expanded === alert.id
          return (
            <div
              key={alert.id}
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${s.border}`, background: s.bg }}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpanded(isOpen ? null : alert.id)}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: s.dot }}
                />
                <span className="font-semibold text-sm flex-1" style={{ color: s.text }}>
                  {alert.event}
                </span>
                {alert.expires && (
                  <span className="text-xs shrink-0" style={{ color: s.text, opacity: 0.7 }}>
                    Until {fmtExpires(alert.expires)}
                  </span>
                )}
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={s.text} strokeWidth="2"
                  style={{ transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s', flexShrink: 0, opacity: 0.7 }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {isOpen && (
                <div
                  className="px-4 pb-4 text-xs leading-relaxed"
                  style={{ color: s.text, borderTop: `1px solid ${s.border}`, paddingTop: '10px', whiteSpace: 'pre-wrap' }}
                >
                  {alert.headline && alert.headline !== alert.event && (
                    <p className="font-semibold mb-2">{alert.headline}</p>
                  )}
                  {alert.description}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
