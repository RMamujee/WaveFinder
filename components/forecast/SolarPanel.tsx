'use client'

import { useQuery } from '@tanstack/react-query'
import type { SolarData } from '@/lib/api/sunrise-sunset'
import { formatSpotLocalTime } from '@/lib/forecast/local-time'
import { Icon } from '@/components/ui/Icon'

interface Props {
  spotSlug: string
  selectedDate?: string | null
  /** The spot's IANA zone from the forecast payload. sunrise-sunset.org returns
   *  absolute UTC instants, so without this the panel renders a Bali sunrise on
   *  a California clock — which is why it was left unmounted until now. */
  timezone?: string | null
  /** Fallback for payloads cached before `timezone` was threaded through. */
  utcOffsetSeconds?: number | null
}

/** "UTC+8", "UTC−3:30" — the honest label when only a numeric offset is known. */
function offsetLabel(seconds: number): string {
  const sign = seconds < 0 ? '−' : '+'
  const total = Math.round(Math.abs(seconds) / 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
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

function TimeRow({ label, time, accent }: { label: string; time: string | null; accent?: string }) {
  // No spot-local rendering available → no row. Showing the instant in the
  // viewer's timezone would be a confident wrong answer, and a dash beside
  // every label is just noise.
  if (!time) return null
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: accent ?? 'var(--text)' }}>
        {time}
      </span>
    </div>
  )
}

export function SolarPanel({ spotSlug, selectedDate, timezone, utcOffsetSeconds }: Props) {
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

  // Day length is a duration and stays correct with no zone at all; every
  // clock time below needs one, and renders nothing without it.
  const zone = { timezone, utcOffsetSeconds }
  const times = {
    dawn:    formatSpotLocalTime(data.civilTwilightBegin, zone),
    sunrise: formatSpotLocalTime(data.sunrise, zone),
    noon:    formatSpotLocalTime(data.solarNoon, zone),
    sunset:  formatSpotLocalTime(data.sunset, zone),
    dusk:    formatSpotLocalTime(data.civilTwilightEnd, zone),
  }
  // Name the zone only if it is the one actually used. Probing with the zone
  // alone (no offset to fall back on) is what tells an unusable name apart from
  // a usable one, so the footer can't caption an offset-rendered clock with an
  // IANA name that was rejected.
  const usedIanaZone = timezone != null && formatSpotLocalTime(data.sunrise, { timezone }) != null
  const zoneNote = usedIanaZone
    ? `Times at the spot (${timezone.replace(/_/g, ' ')})`
    : times.sunrise != null && utcOffsetSeconds != null
      ? `Times at the spot (${offsetLabel(utcOffsetSeconds)})`
      : 'Local times unavailable for this spot'

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
            { label: 'Dawn', time: times.dawn, pct: 0 },
            { label: 'Sunrise', time: times.sunrise, pct: 20 },
            { label: 'Noon', time: times.noon, pct: 50 },
            { label: 'Sunset', time: times.sunset, pct: 80 },
            { label: 'Dusk', time: times.dusk, pct: 100 },
          ].map(({ label, time, pct }) => (
            <div
              key={label}
              className="absolute -top-6 flex flex-col items-center"
              style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
              title={time ? `${label} — ${time}` : label}
            >
              <span style={{ fontSize: 9, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-0">
          <TimeRow label="Civil dawn (first light)" time={times.dawn} accent="#f97316" />
          <TimeRow label="Sunrise" time={times.sunrise} accent="#f59e0b" />
          <TimeRow label="Solar noon" time={times.noon} />
          <TimeRow label="Sunset" time={times.sunset} accent="#f97316" />
          <TimeRow label="Civil dusk (last light)" time={times.dusk} accent="#7c3aed" />
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
        {zoneNote} · Source: sunrise-sunset.org
      </p>
    </div>
  )
}
