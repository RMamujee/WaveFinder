'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { NWSAlert } from '@/lib/api/nws-alerts'
import { formatDistanceToNow, parseISO } from 'date-fns'

interface Props { spotSlug: string }

const SEVERITY_STYLE: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  Extreme: { bg: '#fff1f2', border: '#fda4af', text: '#9f1239', icon: '🚨' },
  Severe:  { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c', icon: '⚠️' },
  Moderate:{ bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '⚡' },
  Minor:   { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: 'ℹ️' },
  Unknown: { bg: '#f9fafb', border: '#e5e7eb', text: '#374151', icon: 'ℹ️' },
}

function AlertCard({ alert }: { alert: NWSAlert }) {
  const [expanded, setExpanded] = useState(false)
  const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.Unknown

  // Guarded: an unparseable expiry from the NWS feed must degrade to "no
  // expiry shown", not throw and blank the whole forecast page.
  const expiresIn = (() => {
    if (!alert.expires) return null
    const d = parseISO(alert.expires)
    if (Number.isNaN(d.getTime())) return null
    return formatDistanceToNow(d, { addSuffix: true })
  })()

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: style.bg, border: `1px solid ${style.border}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>{style.icon}</span>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-snug" style={{ color: style.text }}>
              {alert.event}
            </p>
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: style.text, opacity: 0.85 }}>
              {alert.headline}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expiresIn && (
            <span className="text-xs whitespace-nowrap" style={{ color: style.text, opacity: 0.7 }}>
              expires {expiresIn}
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium px-2 py-1 rounded-lg transition hover:opacity-80"
            style={{ background: style.border, color: style.text }}
          >
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {alert.description && (
            <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: style.text, opacity: 0.9 }}>
              {alert.description}
            </p>
          )}
          {alert.instruction && (
            <div
              className="rounded-lg px-3 py-2 text-xs leading-relaxed"
              style={{ background: 'rgba(0,0,0,0.04)', color: style.text }}
            >
              <span className="font-semibold">Safety instructions: </span>
              {alert.instruction}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CoastalAlertsPanel({ spotSlug }: Props) {
  const { data, isLoading } = useQuery<{ alerts: NWSAlert[] }>({
    queryKey: ['coastal-alerts', spotSlug],
    queryFn: () => fetch(`/api/coastal-alerts/${spotSlug}`).then((r) => {
      if (!r.ok) throw new Error('coastal-alerts-unavailable')
      return r.json()
    }),
    staleTime: 15 * 60 * 1000,
    // Like every other panel: one shot. The global default retries 3x, which
    // against api.weather.gov would quadruple calls exactly when it is down.
    retry: false,
  })

  if (isLoading || !data?.alerts?.length) return null

  return (
    <div className="mx-auto max-w-7xl px-5 pt-3">
      <div className="space-y-2">
        {data.alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
      <p className="text-xs mt-1.5 text-right" style={{ color: 'var(--text-3)' }}>
        Source: NOAA National Weather Service
      </p>
    </div>
  )
}
