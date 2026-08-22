'use client'

import { useQuery } from '@tanstack/react-query'
import type { RiverStation } from '@/lib/api/usgs-river'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Icon } from '@/components/ui/Icon'

interface Props { spotSlug: string }

const FLOW_STYLE: Record<RiverStation['flowLevel'], { label: string; color: string; bg: string; border: string }> = {
  low:      { label: 'Low flow',     color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
  moderate: { label: 'Moderate',     color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  high:     { label: 'High flow',    color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  flood:    { label: 'Flood stage',  color: '#7f1d1d', bg: '#fff1f2', border: '#fda4af' },
}

export function RiverRunoffPanel({ spotSlug }: Props) {
  const { data, isLoading } = useQuery<{ stations: RiverStation[] }>({
    queryKey: ['river-runoff', spotSlug],
    queryFn: () => fetch(`/api/river-runoff/${spotSlug}`).then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  if (isLoading || !data?.stations?.length) return null

  // Only show if any station has elevated flow — low-flow data isn't
  // interesting, and neither is moderate. The old condition only bailed when
  // EVERY station read low, so an all-moderate set still rendered a runoff
  // panel with nothing to warn about.
  const elevated = data.stations.filter((s) => s.flowLevel === 'high' || s.flowLevel === 'flood')
  if (!elevated.length) return null

  return (
    <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="wave" size={18} strokeWidth={1.5} style={{ color: 'var(--ocean-500)' }} />
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          River Runoff
        </span>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>USGS streamflow · 55 km radius</span>
      </div>

      {elevated.length > 0 && (
        <div
          className="rounded-xl px-3 py-2 mb-3 text-xs"
          style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' }}
        >
          ⚠️ Elevated streamflow nearby may carry contaminants to the beach. Consider delaying your session after heavy rain.
        </div>
      )}

      <div className="space-y-2">
        {data.stations.map((s) => {
          const style = FLOW_STYLE[s.flowLevel]
          const timeAgo = s.time ? formatDistanceToNow(parseISO(s.time), { addSuffix: true }) : ''
          return (
            <div
              key={s.siteId}
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: style.bg, border: `1px solid ${style.border}` }}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {s.siteName}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {s.dischargeCfs.toLocaleString()} cfs · {timeAgo}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold shrink-0 ml-3"
                style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
              >
                {style.label}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>
        Source: USGS National Water Information System
      </p>
    </div>
  )
}
