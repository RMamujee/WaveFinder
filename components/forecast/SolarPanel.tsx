'use client'

import { useQuery } from '@tanstack/react-query'
import type { SolarData } from '@/lib/api/sunrise-sunset'
import { format, parseISO } from 'date-fns'
import { Icon } from '@/components/ui/Icon'

interface Props {
  spotSlug: string
  selectedDate?: string | null
}

function formatUTC(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a')
  } catch {
    return '—'
  }
}

function MoonBar({ phase }: { phase: number }) {
  // Illumination from phase (0=new, 0.5=full, 1=new)
  const illum = Math.round((1 - Math.cos(2 * Math.PI * phase)) / 2 * 100)
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 rounded-full"
        style={{ width: `${illum}%`, minWidth: 4, background: '#fbbf24', transition: 'width 0.3s' }}
      />
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{illum}% lit</span>
    </div>
  )
}

function TimeRow({ label, time, accent }: { label: string; time: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: accent ?? 'var(--text)' }}>
        {time}
      </span>
    </div>
  )
}

export function SolarPanel({ spotSlug, selectedDate }: Props) {
  const date = selectedDate ?? undefined
  const { data, isLoading } = useQuery<SolarData>({
    queryKey: ['solar', spotSlug, date],
    queryFn: () => {
      const url = date
        ? `/api/solar/${spotSlug}?date=${date}`
        : `/api/solar/${spotSlug}`
      return fetch(url).then((r) => {
        if (!r.ok) throw new Error('solar-unavailable')
        return r.json()
      })
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="rounded-2xl p-5 animate-pulse" style={{ background: 'white', border: '1px solid var(--border)', minHeight: 160 }} />
    )
  }
  if (!data) return null

  const hours = Math.floor(data.dayLengthSeconds / 3600)
  const mins  = Math.floor((data.dayLengthSeconds % 3600) / 60)

  return (
    <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
      {/* Solar times */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="sun" size={18} strokeWidth={1.5} style={{ color: '#f59e0b' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Daylight</span>
          <span className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>
            {hours}h {mins}m
          </span>
        </div>

        {/* Horizontal sunrise → sunset bar */}
        <div className="relative mb-3">
          <div className="h-2 rounded-full" style={{ background: 'var(--sand-200)' }}>
            <div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #fb923c 0%, #fbbf24 40%, #fbbf24 60%, #f97316 100%)',
                width: '100%',
              }}
            />
          </div>
          {/* Tick marks for key times */}
          {[
            { label: 'Dawn', time: formatUTC(data.civilTwilightBegin), pct: 0 },
            { label: 'Sunrise', time: formatUTC(data.sunrise), pct: 20 },
            { label: 'Noon', time: formatUTC(data.solarNoon), pct: 50 },
            { label: 'Sunset', time: formatUTC(data.sunset), pct: 80 },
            { label: 'Dusk', time: formatUTC(data.civilTwilightEnd), pct: 100 },
          ].map(({ label, time, pct }) => (
            <div
              key={label}
              className="absolute -top-6 flex flex-col items-center"
              style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
              title={`${label} — ${time}`}
            >
              <span style={{ fontSize: 9, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-0">
          <TimeRow label="Civil dawn (first light)" time={formatUTC(data.civilTwilightBegin)} accent="#f97316" />
          <TimeRow label="Sunrise" time={formatUTC(data.sunrise)} accent="#f59e0b" />
          <TimeRow label="Solar noon" time={formatUTC(data.solarNoon)} />
          <TimeRow label="Sunset" time={formatUTC(data.sunset)} accent="#f97316" />
          <TimeRow label="Civil dusk (last light)" time={formatUTC(data.civilTwilightEnd)} accent="#7c3aed" />
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

      {/* Moon */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontSize: 20 }}>{data.moonEmoji}</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {data.moonPhaseName}
          </span>
        </div>
        <MoonBar phase={data.moonPhase} />
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
          {data.moonPhase < 0.1 || data.moonPhase > 0.9
            ? 'New moon — stronger tidal range, watch for lower lows and higher highs'
            : data.moonPhase > 0.4 && data.moonPhase < 0.6
            ? 'Full moon — spring tides, increased tidal movement'
            : 'Moderate tidal influence'}
        </p>
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>
        Times in UTC · Source: sunrise-sunset.org
      </p>
    </div>
  )
}
