import type { BuoyReading } from '@/types/forecast'
import { degreesToCompass } from '@/lib/forecast/rating'
import { formatDistanceToNow, parseISO } from 'date-fns'

interface Props {
  buoy: BuoyReading
  buoyId: string
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

export function BuoyReadings({ buoy, buoyId }: Props) {
  const age = formatDistanceToNow(parseISO(buoy.time), { addSuffix: true })

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'white' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--sand-50)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Live Buoy — NDBC {buoyId}</h3>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {age}
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Wave Height" value={buoy.waveHeight != null ? `${(buoy.waveHeight * 3.281).toFixed(1)}ft` : '—'} />
        <Stat label="Dom. Period" value={`${buoy.dominantPeriod}s`} />
        <Stat label="Avg Period"  value={`${buoy.averagePeriod}s`} />
        <Stat label="Swell Dir"   value={degreesToCompass(buoy.meanDirection)} />
        {buoy.waterTemp !== null && (
          <Stat label="Water Temp" value={`${Math.round(buoy.waterTemp * 9/5 + 32)}°F`} />
        )}
        {buoy.windSpeed !== null && (
          <Stat
            label="Wind (Buoy)"
            value={`${Math.round(buoy.windSpeed * 2.237)} mph ${buoy.windDirection !== null ? degreesToCompass(buoy.windDirection) : ''}`}
          />
        )}
      </div>
    </div>
  )
}
