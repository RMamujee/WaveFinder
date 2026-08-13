'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import type { SurfSpot } from '@/types/spot'
import type { SpotForecast, ForecastDay, ConditionRating } from '@/types/forecast'
const WaveChart = dynamic(() => import('@/components/forecast/WaveChart').then((m) => m.WaveChart), { ssr: false, loading: () => null })
const WindChart = dynamic(() => import('@/components/forecast/WindChart').then((m) => m.WindChart), { ssr: false, loading: () => null })
const WindRoseChart = dynamic(() => import('@/components/forecast/WindRoseChart').then((m) => m.WindRoseChart), { ssr: false, loading: () => null })
const TideChart = dynamic(() => import('@/components/forecast/TideChart').then((m) => m.TideChart), { ssr: false, loading: () => null })
const UVChart = dynamic(() => import('@/components/forecast/UVChart').then((m) => m.UVChart), { ssr: false, loading: () => null })
import { GearPanel } from '@/components/forecast/GearPanel'
import { ForecastDayCard } from '@/components/forecast/ForecastDayCard'
import { BuoyReadings } from '@/components/forecast/BuoyReadings'
import { SwellPanel } from '@/components/forecast/SwellPanel'
import { StormAlerts } from '@/components/forecast/StormAlerts'
import { SaveSpotButton } from '@/components/spots/SaveSpotButton'
import { SwellAlertButton } from '@/components/forecast/SwellAlertButton'
import type { NWSAlert } from '@/lib/api/noaa-alerts'
import { SurfReports } from '@/components/forecast/SurfReports'
import { BestTimePanel } from '@/components/forecast/BestTimePanel'
import { WaterQualityPanel } from '@/components/forecast/WaterQualityPanel'
import { IdealConditionsPanel } from '@/components/forecast/IdealConditionsPanel'
import { SpotSatelliteMap } from '@/components/forecast/SpotSatelliteMap'
import { AirQualityPanel } from '@/components/forecast/AirQualityPanel'
import { EarthquakePanel } from '@/components/forecast/EarthquakePanel'
import { AmenitiesPanel } from '@/components/forecast/AmenitiesPanel'
import { RiverRunoffPanel } from '@/components/forecast/RiverRunoffPanel'
import { SeasonalClimatePanel } from '@/components/forecast/SeasonalClimatePanel'
import { computeBestTimes } from '@/lib/forecast/best-time'
import { degreesToCompass } from '@/lib/forecast/rating'
import { BOTTOM_TYPE_STYLE } from '@/lib/bottom-type'
import { SeasonCalendar } from '@/components/spots/SeasonCalendar'
import { LazyMount } from '@/components/util/LazyMount'
import { WaveLoader } from '@/components/layout/WaveLoader'
import { weatherIcon, weatherLabel } from '@/lib/forecast/weather-code'
import { Icon } from '@/components/ui/Icon'
import { format, parseISO } from 'date-fns'
import { useUnits } from '@/contexts/UnitsContext'
import { fmtHeight, fmtWind, fmtTemp } from '@/lib/units'

interface Props { spot: SurfSpot }

const RATING_STYLES: Record<ConditionRating, { bg: string; border: string; text: string; accent: string }> = {
  poor:  { bg: '#f9fafb', border: '#e5e7eb', text: '#4b5563', accent: '#9ca3af' },
  fair:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', accent: '#f59e0b' },
  good:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', accent: '#16a34a' },
  epic:  { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', accent: '#7c3aed' },
}

function getWaterQuality(windSpeedKmh: number, windDir: number, spotFacing: number): { label: string; color: string } {
  const mph = windSpeedKmh * 0.621371
  if (mph < 5) return { label: 'Glassy', color: '#16a34a' }
  const diff = Math.abs(((windDir - spotFacing + 180) % 360) - 180)
  const offshore = diff > 90
  if (mph < 10) return offshore ? { label: 'Clean', color: '#0e7490' } : { label: 'Light Chop', color: '#b45309' }
  if (mph < 18) return offshore ? { label: 'Offshore', color: '#0369a1' } : { label: 'Choppy', color: '#dc2626' }
  return { label: 'Rough', color: '#9f1239' }
}

function StatBlock({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div style={{ minWidth: '52px' }}>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 600, lineHeight: 1, color: valueColor ?? 'var(--text)', whiteSpace: 'nowrap' }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>}
    </div>
  )
}

const DIFFICULTY_STYLES = {
  beginner:     { color: '#15803d', bg: '#f0fdf4' },
  intermediate: { color: '#b45309', bg: '#fffbeb' },
  advanced:     { color: '#b91c1c', bg: '#fef2f2' },
  expert:       { color: '#6b21a8', bg: '#faf5ff' },
}

export function SpotForecastView({ spot }: Props) {
  const { unit } = useUnits()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedDay, setSelectedDay] = useState<string | null>(
    searchParams.get('date')
  )

  function selectDay(date: string) {
    setSelectedDay(date)
    router.replace(`/spots/${spot.slug}?date=${date}`, { scroll: false })
  }

  const { data: forecast, isPending, isFetching, error, dataUpdatedAt } = useQuery<SpotForecast>({
    queryKey: ['forecast', spot.slug],
    queryFn: async () => {
      const r = await fetch(`/api/forecast/${spot.slug}`)
      if (!r.ok) throw new Error(`forecast-${r.status}`)
      return r.json() as Promise<SpotForecast>
    },
    staleTime: 30 * 60 * 1000,
    // A tab left open must not show dawn conditions at noon: nothing else in
    // the app triggers a refetch (focus-refetch is globally off), so this
    // interval is the only thing keeping a long-lived page current.
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 4000),
  })

  const { data: alerts = [] } = useQuery<NWSAlert[]>({
    queryKey: ['alerts', spot.slug],
    queryFn: () => fetch(`/api/alerts/${spot.slug}`).then((r) => r.json()),
    staleTime: 30 * 60 * 1000,
  })

  const activeDayData: ForecastDay | undefined =
    forecast?.forecast?.find((d) => d.date === selectedDay) ?? forecast?.forecast?.[0]

  // Re-derive "current" client-side: the server-computed currentCondition is
  // frozen into CDN-cached JSON (s-maxage=3600+swr=600) at generation time and
  // can be ~2 h stale by the time it renders. The payload's utcOffsetSeconds
  // lets us pick the spot's in-progress hour from forecast[] on our own clock;
  // payloads cached before that field existed fall back to the server's pick.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
  const current = useMemo(() => {
    if (forecast?.utcOffsetSeconds == null) return forecast?.currentCondition ?? null
    const nowHour = new Date(nowTick + forecast.utcOffsetSeconds * 1000)
      .toISOString()
      .slice(0, 13)
    for (const d of forecast.forecast ?? []) {
      const hit = d.hours.find((h) => h.time.slice(0, 13) >= nowHour)
      if (hit) return hit
    }
    return forecast.currentCondition ?? null
  }, [forecast, nowTick])
  const ratingStyle = current ? RATING_STYLES[current.rating] : RATING_STYLES.poor

  const bestTimes = useMemo(() => {
    if (!activeDayData?.hours.length) return []
    return computeBestTimes(activeDayData.hours, spot.facingDirection, forecast?.tides)
  }, [activeDayData, spot.facingDirection, forecast?.tides])

  const diffStyle = DIFFICULTY_STYLES[spot.difficulty as keyof typeof DIFFICULTY_STYLES] ?? DIFFICULTY_STYLES.beginner

  return (
    <div className="min-h-screen" style={{ background: 'var(--sand-50)' }}>
      {/* Hero condition banner */}
      <div
        className="relative overflow-hidden"
        style={{
          background: current ? ratingStyle.bg : '#f0f8ff',
          borderBottom: `1px solid ${current ? ratingStyle.border : 'var(--border)'}`,
        }}
      >
        {/* Wave pattern overlay */}
        <svg
          className="absolute bottom-0 right-0 opacity-5"
          width="400" height="120" viewBox="0 0 400 120" preserveAspectRatio="none"
        >
          <path d="M0,60 C50,20 100,100 150,60 C200,20 250,100 300,60 C350,20 400,80 400,60 L400,120 L0,120 Z"
            fill={current ? ratingStyle.accent : '#1b7fcb'} />
        </svg>

        <div className="mx-auto max-w-7xl px-5 py-8 relative">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs mb-4" style={{ color: 'var(--text-3)' }}>
            <Link href="/spots" style={{ color: 'var(--ocean-600)' }}>Spots</Link>
            <span>/</span>
            <span>{spot.region}</span>
            <span>/</span>
            <span style={{ color: 'var(--text-2)' }}>{spot.name}</span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4 sm:gap-6">
            {/* Left: name + current reading */}
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1
                  style={{
                    fontFamily: 'var(--font-playfair), serif',
                    fontSize: 'clamp(24px, 4vw, 36px)',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                  }}
                >
                  {spot.name}
                </h1>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize shrink-0"
                  style={{ background: diffStyle.bg, color: diffStyle.color }}
                >
                  {spot.difficulty}
                </span>
                {spot.bottomType && (() => {
                  const bt = BOTTOM_TYPE_STYLE[spot.bottomType] ?? BOTTOM_TYPE_STYLE.mixed
                  return (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold shrink-0"
                      style={{ background: bt.bg, color: bt.color }}
                    >
                      {bt.label} bottom
                    </span>
                  )
                })()}
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--text-2)' }}>
                {spot.region}, {spot.country}
              </p>

              {isPending ? null : current ? (
                <div className="flex flex-wrap items-start gap-5 sm:gap-7">
                  {/* Wave height — hero stat, larger */}
                  <div style={{ minWidth: '52px' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Height</p>
                    <p style={{ fontSize: '34px', fontWeight: 700, lineHeight: 1, color: 'var(--text)', fontFamily: 'var(--font-playfair), serif' }}>
                      {fmtHeight(current.waveHeight, unit)}
                    </p>
                  </div>

                  <div className="self-stretch w-px" style={{ background: 'var(--border)', margin: '2px 0' }} />

                  <StatBlock
                    label="Period"
                    value={`${Math.round(current.swellPeriod)}s`}
                  />
                  <StatBlock
                    label="Swell"
                    value={degreesToCompass(current.swellDirection)}
                    sub={`${current.swellDirection}°`}
                  />
                  <StatBlock
                    label="Wind"
                    value={fmtWind(current.wind.speed, unit)}
                    sub={current.wind.directionLabel}
                  />
                  {(() => {
                    const wq = getWaterQuality(current.wind.speed, current.wind.direction, spot.facingDirection)
                    return <StatBlock label="Surface" value={wq.label} valueColor={wq.color} />
                  })()}
                  {current.waterTemp !== null && (
                    <StatBlock
                      label="Water"
                      value={fmtTemp(current.waterTemp, unit)}
                    />
                  )}
                  {current.wavePower > 0 && (
                    <StatBlock label="Power" value={`${current.wavePower}`} sub="kW/m" />
                  )}
                </div>
              ) : error ? (
                <p className="text-sm" style={{ color: '#ef4444' }}>Failed to load forecast data.</p>
              ) : null}
              {!isPending && current && (forecast?.fetchedAt || dataUpdatedAt > 0) && (
                <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>
                  {/* fetchedAt is when the ORIGIN generated this payload — a CDN
                      hit can serve data older than the fetch, so the fetch time
                      would manufacture the appearance of freshness. */}
                  Updated {forecast?.fetchedAt
                    ? format(parseISO(forecast.fetchedAt), 'h:mm a')
                    : format(dataUpdatedAt, 'h:mm a')}
                  {isFetching ? ' · refreshing…' : ''}
                </p>
              )}
            </div>

            {/* Right: wind rose + rating badge + actions */}
            <div className="flex items-start gap-4">
              {forecast && (
                <div className="hidden sm:flex flex-col items-center">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-3)' }}>
                    Wind — {activeDayData ? format(parseISO(activeDayData.date), 'EEE, MMM d') : '16 day'}
                  </p>
                  <WindRoseChart days={activeDayData ? [activeDayData] : forecast.forecast} size={175} showLegend={false} />
                  <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1.5" style={{ maxWidth: 150 }}>
                    {[
                      { color: '#16a34a', label: '<10' },
                      { color: '#f59e0b', label: '10–20' },
                      { color: '#f97316', label: '20–30' },
                      { color: '#ef4444', label: '30+' },
                    ].map(b => (
                      <div key={b.label} className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-sm" style={{ background: b.color }} />
                        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col items-end gap-3">
                {current && (
                  <div
                    className="flex flex-col items-center justify-center rounded-2xl px-6 py-4"
                    style={{
                      background: ratingStyle.bg,
                      border: `2px solid ${ratingStyle.border}`,
                      minWidth: '110px',
                    }}
                  >
                    <span
                      className="font-black uppercase tracking-wider"
                      style={{
                        fontSize: current.rating === 'epic' ? '22px' : '20px',
                        color: ratingStyle.text,
                        fontFamily: 'var(--font-playfair), serif',
                      }}
                    >
                      {current.rating === 'epic' ? 'EPIC' : current.rating.charAt(0).toUpperCase() + current.rating.slice(1)}
                    </span>
                    <div
                      className="mt-1.5 h-1.5 w-full rounded-full"
                      style={{ background: 'var(--sand-200)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${current.ratingScore}%`, background: ratingStyle.accent }}
                      />
                    </div>
                    <p className="text-xs mt-1 font-medium" style={{ color: ratingStyle.text }}>
                      {current.ratingScore}/100
                    </p>
                  </div>
                )}
                <SaveSpotButton spotId={spot.id} />
                <SwellAlertButton spotSlug={spot.slug} spotName={spot.name} forecastDays={forecast?.forecast} />
                <a
                  href={`/sessions?spot=${encodeURIComponent(spot.name)}&region=${encodeURIComponent(spot.region)}&slug=${spot.slug}`}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                  style={{ background: 'var(--ocean-600)' }}
                >
                  Log Session
                </a>
                <ShareButton slug={spot.slug} selectedDay={selectedDay} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {spot.description && (
        <div style={{ borderBottom: '1px solid var(--border)', background: 'white' }}>
          <div className="mx-auto max-w-7xl px-5 py-3">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>{spot.description}</p>
          </div>
        </div>
      )}

      {/* Storm / coastal alerts from NOAA Weather.gov */}
      {alerts.length > 0 && <StormAlerts alerts={alerts} />}

      {/* Body */}
      {isPending && <WaveLoader label="Fetching forecast…" />}
      {error && !isPending && !isFetching && (
        <div className="mx-auto max-w-7xl px-5 pt-4">
          <div className="rounded-2xl p-6 text-center" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
            <p className="text-sm font-semibold" style={{ color: '#b91c1c' }}>Failed to load forecast data.</p>
            <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Check your connection and refresh the page to try again.</p>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-7xl px-5 py-4 space-y-4" style={{ display: isPending ? 'none' : undefined }}>

        {/* 16-day strip — horizontally scrollable, snap-aligned */}
        <div>
          <SectionTitle>16-Day Forecast</SectionTitle>
          {forecast?.forecast ? (
            <div
              className="overflow-x-auto overflow-y-hidden -mx-5 px-5 snap-x snap-mandatory"
              style={{
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
                scrollPaddingLeft: '1.25rem',
              }}
            >
              <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
                {forecast.forecast.map((day) => (
                  <div
                    key={day.date}
                    className="snap-start w-[88px] sm:w-[108px] flex-shrink-0"
                  >
                    <ForecastDayCard
                      day={day}
                      isSelected={
                        selectedDay === day.date ||
                        (!selectedDay && day === forecast.forecast[0])
                      }
                      onClick={() => selectDay(day.date)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Ideal Conditions + Current Break Character */}
        <div>
          <SectionTitle>Ideal Conditions</SectionTitle>
          <IdealConditionsPanel
            spot={spot}
            current={current ?? null}
            buoy={forecast?.buoy}
            coastalWind={forecast?.coastalWind}
          />
        </div>

        {/* Row 2: Best Times (col 1, spans 2 rows) | Wind (col 2) | UV (col 3) | Satellite (cols 2+3, row 2) */}
        {forecast?.forecast && activeDayData && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Best Times — col 1, spans both rows */}
            <div className="lg:row-span-2">
              <SectionTitle>
                Best Times
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-3)' }}>
                  {format(parseISO(activeDayData.date), 'EEE, MMM d')}
                </span>
              </SectionTitle>
              {bestTimes.length > 0 ? (
                <BestTimePanel slots={bestTimes} tides={forecast.tides} />
              ) : (
                <div className="rounded-2xl p-8 text-center text-sm" style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  No session windows available for this day.
                </div>
              )}
            </div>

            {/* Wind Speed — col 2, row 1 */}
            <div>
              <SectionTitle>Wind Speed</SectionTitle>
              <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
                <WindChart days={forecast.forecast} activeDayData={activeDayData} />
              </div>
            </div>

            {/* UV Index — col 3, row 1 */}
            <div>
              <SectionTitle>
                UV Index —{' '}
                <span style={{ fontWeight: 400 }}>{format(parseISO(activeDayData.date), 'EEE, MMM d')}</span>
              </SectionTitle>
              <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
                <UVChart activeDayData={activeDayData} />
              </div>
            </div>

            {/* Satellite — cols 2+3, row 2 (stretches to fill remaining Best Times height) */}
            <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column' }}>
              <SectionTitle>Satellite View</SectionTitle>
              <div
                className="rounded-2xl overflow-hidden isolate"
                style={{ border: '1px solid var(--border)', flex: 1, minHeight: '260px' }}
              >
                <LazyMount minHeight={280} style={{ height: '100%' }}>
                  <SpotSatelliteMap
                    lat={spot.lat}
                    lng={spot.lng}
                    spotName={spot.name}
                    facingDirection={spot.facingDirection}
                  />
                </LazyMount>
              </div>
            </div>
          </div>
        )}

        {/* Row 3: Hourly table — full width */}
        {forecast?.forecast && activeDayData && (
          <div>
            <SectionTitle>
              Hourly —{' '}
              {format(parseISO(activeDayData.date), 'EEEE, MMM d')}
            </SectionTitle>
            <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ border: '1px solid var(--border)', background: 'white' }}>
              <table className="w-full text-sm" style={{ minWidth: '480px' }}>
                <thead style={{ borderBottom: '1px solid var(--border)', background: 'var(--sand-50)' }}>
                  <tr className="text-left">
                    <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>Time</th>
                    <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>Height</th>
                    <th className="hidden sm:table-cell px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>Period</th>
                    <th className="hidden sm:table-cell px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>Dir</th>
                    <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>Wind</th>
                    <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>Weather</th>
                    <th className="hidden sm:table-cell px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>Temp</th>
                    <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDayData.hours
                    .filter((_, i) => i % 3 === 0)
                    .map((h, i) => {
                      const rs = RATING_STYLES[h.rating]
                      // On mobile hide every-other row (effectively 6h intervals)
                      const mobileHidden = i % 2 !== 0 ? 'hidden sm:table-row' : ''
                      return (
                        <tr
                          key={h.time}
                          className={mobileHidden}
                          style={{
                            borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                            background: h.ratingScore >= 60 ? rs.bg : 'white',
                          }}
                        >
                          <td className="px-4 py-3 text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                            {format(parseISO(h.time), 'ha')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-xs whitespace-nowrap" style={{ color: 'var(--text)' }}>
                            {fmtHeight(h.waveHeight, unit)}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>
                            {Math.round(h.swellPeriod)}s
                          </td>
                          <td className="hidden sm:table-cell px-4 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
                            {degreesToCompass(h.swellDirection)}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                            {fmtWind(h.wind.speed, unit)} {h.wind.directionLabel}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span title={weatherLabel(h.weatherCode)} style={{ lineHeight: 1 }}>
                              {h.weatherCode !== null ? <Icon name={weatherIcon(h.weatherCode)} size={16} /> : '—'}
                            </span>
                            {h.precipProb !== null && h.precipProb >= 20 && (
                              <span className="ml-1 text-xs" style={{ color: '#1b7fcb' }}>
                                {h.precipProb}%
                              </span>
                            )}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                            {fmtTemp(h.airTempC, unit)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
                              style={{ background: rs.bg, color: rs.text, border: `1px solid ${rs.border}` }}
                            >
                              {h.rating}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Row 4: Wave Height — full width (matches Tides) */}
        {forecast?.forecast && (
          <div>
            <SectionTitle>Wave Height</SectionTitle>
            <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
              <WaveChart days={forecast.forecast} activeDayData={activeDayData} />
              <div className="flex items-center gap-4 mt-3">
                <Legend color="#1b7fcb" label="Total wave height" />
                <Legend color="#7c3aed" label="Swell height" />
              </div>
            </div>
          </div>
        )}

        {/* Row 5: Tides — full width */}
        {forecast?.tides && forecast.tides.length > 0 && (
          <div>
            <SectionTitle>Tides</SectionTitle>
            <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
              <TideChart tides={forecast.tides} selectedDate={activeDayData?.date} />
            </div>
          </div>
        )}

        {/* Row 6: Swell | Air Quality — 2-col; Gear + Seasonal stacked in right column */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Swell — col 1 */}
          {current && (
            <div>
              <SectionTitle>
                Swell —{' '}
                <span style={{ fontWeight: 400 }}>{activeDayData ? format(parseISO(activeDayData.date), 'EEE, MMM d') : 'Now'}</span>
              </SectionTitle>
              <SwellPanel current={current} activeDayData={activeDayData} />
            </div>
          )}

          {/* Air Quality — col 2 */}
          <div>
            <SectionTitle>Air Quality</SectionTitle>
            <AirQualityPanel spotSlug={spot.slug} />
          </div>

          {/* Gear + Seasonal stacked — col 3 */}
          {activeDayData && (() => {
            const waterHours = activeDayData.hours.filter((h) => h.waterTemp !== null)
            const avgWaterTempC = waterHours.length > 0
              ? waterHours.reduce((sum, h) => sum + (h.waterTemp ?? 0), 0) / waterHours.length
              : null
            return (
              <div className="flex flex-col gap-4">
                <div>
                  <SectionTitle>Gear Recommendations</SectionTitle>
                  <GearPanel activeDayHours={activeDayData.hours} waterTempC={avgWaterTempC} />
                </div>
                <div>
                  <SectionTitle>Seasonal Climate</SectionTitle>
                  <SeasonalClimatePanel spotSlug={spot.slug} />
                </div>
              </div>
            )
          })()}
        </div>

        {/* Row 8: Community Reports (left, full height) | Buoy Data + Season Calendar (right, stacked) */}
        <div className="grid gap-4 md:grid-cols-2 items-start">
          {/* Left — Community Reports at natural full height */}
          <div>
            <SectionTitle>Community Reports</SectionTitle>
            <LazyMount minHeight={160}>
              <SurfReports spotSlug={spot.slug} />
            </LazyMount>
          </div>

          {/* Right — Buoy Data (compact) then Season Calendar directly below */}
          <div className="flex flex-col gap-4">
            {forecast?.buoy && spot.noaaBuoyId && (
              <div>
                <SectionTitle>Live Buoy Data</SectionTitle>
                <BuoyReadings buoy={forecast.buoy} buoyId={spot.noaaBuoyId} />
              </div>
            )}
            <div>
              <SectionTitle>Best Season to Surf</SectionTitle>
              <SeasonCalendar region={spot.region} difficulty={spot.difficulty} />
            </div>
          </div>
        </div>

        {/* Water Quality — only renders when USGS/EPA data exists within 20 miles */}
        <LazyMount minHeight={0}>
          <WaterQualityPanel spotSlug={spot.slug} />
        </LazyMount>

        {/* River runoff — renders its own container only when a gauge is nearby */}
        <LazyMount minHeight={0}>
          <RiverRunoffPanel spotSlug={spot.slug} />
        </LazyMount>

        {/* Nearby facilities from OpenStreetMap */}
        <LazyMount>
          <SectionTitle>Nearby Facilities</SectionTitle>
          <AmenitiesPanel spotSlug={spot.slug} />
        </LazyMount>

        {/* Seismic activity — only shows when M4.5+ quakes found within 800 km */}
        <LazyMount>
          <SectionTitle>Seismic Activity</SectionTitle>
          <EarthquakePanel spotSlug={spot.slug} />
        </LazyMount>

      </div>
    </div>
  )
}


function ShareButton({ slug, selectedDay }: { slug: string; selectedDay: string | null }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    const url = `${origin}/spots/${slug}${selectedDay ? `?date=${selectedDay}` : ''}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'WaveFinder forecast', url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch { /* user cancelled */ }
  }
  return (
    <button
      onClick={share}
      aria-label={copied ? 'Link copied' : 'Share this spot'}
      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-80"
      style={{ background: 'var(--sand-100)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
    >
      {copied ? (
        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg> Copied!</>
      ) : (
        <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share</>
      )}
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-2 font-semibold text-sm"
      style={{ color: 'var(--text-2)', fontFamily: 'var(--font-dm-sans), sans-serif', letterSpacing: '0.03em', textTransform: 'uppercase' }}
    >
      {children}
    </h2>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-4 rounded" style={{ background: color }} />
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
    </div>
  )
}
