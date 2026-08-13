'use client'

import { useQuery } from '@tanstack/react-query'
import type { EarthquakeEvent } from '@/lib/api/usgs-earthquake'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Icon } from '@/components/ui/Icon'

interface Props { spotSlug: string }

function magColor(mag: number): { color: string; bg: string } {
  if (mag >= 7)   return { color: '#9f1239', bg: '#fff1f2' }
  if (mag >= 6)   return { color: '#b91c1c', bg: '#fef2f2' }
  if (mag >= 5)   return { color: '#d97706', bg: '#fffbeb' }
  return               { color: '#4b5563', bg: '#f9fafb' }
}

export function EarthquakePanel({ spotSlug }: Props) {
  const { data, isLoading } = useQuery<{ earthquakes: EarthquakeEvent[] }>({
    queryKey: ['earthquakes', spotSlug],
    queryFn: () => fetch(`/api/earthquakes/${spotSlug}`).then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  if (isLoading || !data?.earthquakes?.length) return null

  const hasTsunami = data.earthquakes.some((e) => e.tsunami === 1)

  return (
    <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="layers" size={18} style={{ color: 'var(--text-3)' }} />
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          Nearby Seismic Activity
        </span>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>Last 30 days · 800 km radius</span>
      </div>

      {hasTsunami && (
        <div
          className="rounded-xl px-3 py-2 mb-3 text-xs font-semibold"
          style={{ background: '#fff1f2', border: '1px solid #fda4af', color: '#9f1239' }}
        >
          ⚠️ One or more of these events generated a tsunami. Check NOAA warnings for current status.
        </div>
      )}

      <div className="space-y-2">
        {data.earthquakes.map((eq) => {
          const { color, bg } = magColor(eq.magnitude)
          const timeAgo = formatDistanceToNow(parseISO(eq.time), { addSuffix: true })
          return (
            <div
              key={eq.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: bg, border: `1px solid ${color}25` }}
            >
              <div
                className="flex items-center justify-center rounded-lg font-black shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background: color,
                  color: 'white',
                  fontSize: 15,
                  fontFamily: 'Playfair Display, serif',
                }}
              >
                M{eq.magnitude.toFixed(1)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {eq.place}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {timeAgo} · {eq.depth} km depth{eq.tsunami === 1 ? ' · tsunami' : ''}
                </p>
              </div>
              {eq.url && (
                <a
                  href={eq.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs shrink-0 ml-auto"
                  style={{ color: 'var(--ocean-600)' }}
                >
                  USGS →
                </a>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>
        Large shallow earthquakes can generate unusual swell or disrupt local bathymetry.
        Source: USGS Earthquake Hazards Program
      </p>
    </div>
  )
}
