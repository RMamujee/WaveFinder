'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import type { SurfSpot } from '@/types/spot'
import type { SpotForecast, ForecastDay, ConditionRating } from '@/types/forecast'
import { WaveChart } from '@/components/forecast/WaveChart'
import { WindChart } from '@/components/forecast/WindChart'
import { TideChart } from '@/components/forecast/TideChart'
import { UVChart } from '@/components/forecast/UVChart'
import { GearPanel } from '@/components/forecast/GearPanel'
import { ForecastDayCard } from '@/components/forecast/ForecastDayCard'
import { BuoyReadings } from '@/components/forecast/BuoyReadings'
import { SwellPanel } from '@/components/forecast/SwellPanel'
import { WebcamPanel } from '@/components/webcam/WebcamPanel'
import { SaveSpotButton } from '@/components/spots/SaveSpotButton'
import { SurfReports } from '@/components/forecast/SurfReports'
import { BestTimePanel } from '@/components/forecast/BestTimePanel'
import { WaterQualityPanel } from '@/components/forecast/WaterQualityPanel'
import { computeBestTimes } from '@/lib/forecast/best-time'
import { degreesToCompass } from '@/lib/forecast/rating'
import { SeasonCalendar } from '@/components/spots/SeasonCalendar'
import { WaveLoader } from '@/components/layout/WaveLoader'
import { weatherIcon, tempF, weatherLabel } from '@/lib/forecast/weather-code'
import { format, parseISO } from 'date-fns'

interface Props { spot: SurfSpot }

const RATING_STYLES: Record<ConditionRating, { bg: string; border: string; text: string; accent: string }> = {
  poor:  { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', accent: '#9ca3af' },
  fair:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e', accent: '#f59e0b' },
  good:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', accent: '#16a34a' },
  epic:  { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', accent: '#7c3aed' },
}

function metersToFeet(m: number) {
  const ft = Math.round(m * 3.281)
  return `${ft}ft`
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
}

export function SpotForecastView({ spot }: Props) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const { data: forecast, isLoading, error } = useQuery<SpotForecast>({
    queryKey: ['forecast', spot.slug],
    queryFn: () => fetch(`/api/forecast/${spot.slug}`).then((r) => r.json()),
    staleTime: 30 * 60 * 1000,
  })

  const activeDayData: ForecastDay | undefined =
    forecast?.forecast?.find((d) => d.date === selectedDay) ?? forecast?.forecast?.[0]

  const current = forecast?.currentCondition
  const ratingStyle = current ? RATING_STYLES[current.rating] : RATING_STYLES.poor

  const bestTimes = useMemo(() => {
    if (!activeDayData?.hours.length) return []
    return computeBestTimes(activeDayData.hours, spot.facingDirection)
  }, [activeDayData, spot.facingDirection])

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
            <a href="/spots" style={{ color: 'var(--ocean-600)' }}>Spots</a>
            <span>/</span>
            <span>{spot.region}</span>
            <span>/</span>
            <span style={{ color: 'var(--text-2)' }}>{spot.name}</span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4 sm:gap-6">
            {/* Left: name + current reading */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1
                  style={{
                    fontFamily: 'Playfair Display, serif',
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
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--text-2)' }}>
                {spot.region}, {spot.country}
              </p>

              {isLoading ? null : current ? (
                <div className="flex flex-wrap items-start gap-5 sm:gap-7">
                  {/* Wave height — hero stat, larger */}
                  <div style={{ minWidth: '52px' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Height</p>
                    <p style={{ fontSize: '34px', fontWeight: 700, lineHeight: 1, color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
                      {metersToFeet(current.waveHeight)}
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
                    value={`${Math.round(current.wind.speed * 0.621371)} mph`}
                    sub={current.wind.directionLabel}
                  />
                  {(() => {
                    const wq = getWaterQuality(current.wind.speed, current.wind.direction, spot.facingDirection)
                    return <StatBlock label="Surface" value={wq.label} valueColor={wq.color} />
                  })()}
                  {current.waterTemp !== null && (
                    <StatBlock
                      label="Water"
                      value={`${Math.round(current.waterTemp * 9/5 + 32)}°F`}
                    />
                  )}
                  {current.wavePower > 0 && (
                    <StatBlock label="Power" value={`${current.wavePower}`} sub="kW/m" />
                  )}
                </div>
              ) : error ? (
                <p className="text-sm" style={{ color: '#ef4444' }}>Failed to load forecast data.</p>
              ) : null}
            </div>

            {/* Right: rating badge + save */}
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
                      fontFamily: 'Playfair Display, serif',
                    }}
                  >
                    {current.rating === 'epic' ? '🏆 EPIC' : current.rating.charAt(0).toUpperCase() + current.rating.slice(1)}
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
              <a
                href={`/sessions?spot=${encodeURIComponent(spot.name)}&region=${encodeURIComponent(spot.region)}&slug=${spot.slug}`}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                style={{ background: 'var(--ocean-600)' }}
              >
                📓 Log Session
              </a>
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

      {/* Body */}
      {isLoading && <WaveLoader label="Fetching forecast…" />}
      <div className="mx-auto max-w-7xl px-5 py-4 space-y-4" style={{ display: isLoading ? 'none' : undefined }}>

        {/* 7-day strip + webcam */}
        <div className="grid gap-4 lg:grid-cols-3 items-stretch">
          {/* 7-day strip */}
          <div className="lg:col-span-2 flex flex-col">
            <SectionTitle>7-Day Forecast</SectionTitle>
            {forecast?.forecast ? (
              <div className="flex-1 grid grid-cols-3 gap-2 sm:grid-cols-7">
                {forecast.forecast.map((day) => (
                  <ForecastDayCard
                    key={day.date}
                    day={day}
                    isSelected={
                      selectedDay === day.date ||
                      (!selectedDay && day === forecast.forecast[0])
                    }
                    onClick={() => setSelectedDay(day.date)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* Webcam */}
          <div>
            <SectionTitle>Live View</SectionTitle>
            <WebcamPanel
              webcamUrl={spot.webcamUrl}
              webcamType={spot.webcamType}
              spotName={spot.name}
              lat={spot.lat}
              lng={spot.lng}
            />
          </div>
        </div>

        {/* Water Quality */}
        <div>
          <SectionTitle>Water Quality</SectionTitle>
          <WaterQualityPanel spotSlug={spot.slug} />
        </div>

        {/* Best time + hourly table */}
        {forecast?.forecast && activeDayData && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Best Times */}
            <div>
              <SectionTitle>
                Best Times
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-3)' }}>
                  {activeDayData ? format(parseISO(activeDayData.date), 'EEE, MMM d') : ''}
                </span>
              </SectionTitle>
              {bestTimes.length > 0 ? (
                <BestTimePanel slots={bestTimes} tides={forecast.tides} />
              ) : (
                <div className="rounded-2xl p-8 text-center text-sm" style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  Loading time recommendations…
                </div>
              )}
            </div>

            {/* Hourly breakdown */}
            <div className="lg:col-span-2">
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
                        return (
                          <tr
                            key={h.time}
                            style={{
                              borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                              background: h.ratingScore >= 60 ? rs.bg : 'white',
                            }}
                          >
                            <td className="px-4 py-3 text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                              {format(parseISO(h.time), 'ha')}
                            </td>
                            <td className="px-4 py-3 font-semibold text-xs whitespace-nowrap" style={{ color: 'var(--text)' }}>
                              {metersToFeet(h.waveHeight)}
                              <span className="ml-1 font-normal hidden sm:inline" style={{ color: 'var(--text-3)', fontSize: '11px' }}>
                                ft
                              </span>
                            </td>
                            <td className="hidden sm:table-cell px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>
                              {Math.round(h.swellPeriod)}s
                            </td>
                            <td className="hidden sm:table-cell px-4 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
                              {degreesToCompass(h.swellDirection)}
                            </td>
                            <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                              {Math.round(h.wind.speed * 0.621371)} mph {h.wind.directionLabel}
                            </td>
                            {/* Weather */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span title={weatherLabel(h.weatherCode)} style={{ fontSize: 16, lineHeight: 1 }}>
                                {h.weatherCode !== null ? weatherIcon(h.weatherCode) : '—'}
                              </span>
                              {h.precipProb !== null && h.precipProb >= 20 && (
                                <span className="ml-1 text-xs" style={{ color: '#1b7fcb' }}>
                                  {h.precipProb}%
                                </span>
                              )}
                            </td>
                            {/* Temp */}
                            <td className="hidden sm:table-cell px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                              {tempF(h.airTempC)}
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
          </div>
        )}

        {/* Charts */}
        {forecast?.forecast && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Wave chart */}
            <div className="lg:col-span-2">
              <SectionTitle>Wave Height</SectionTitle>
              <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
                <WaveChart days={forecast.forecast} activeDayData={activeDayData} />
                <div className="flex items-center gap-4 mt-3">
                  <Legend color="#1b7fcb" label="Total wave height" />
                  <Legend color="#7c3aed" label="Swell height" />
                </div>
              </div>
            </div>

            {/* Wind chart */}
            <div>
              <SectionTitle>Wind Speed</SectionTitle>
              <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
                <WindChart days={forecast.forecast} activeDayData={activeDayData} />
              </div>
            </div>
          </div>
        )}

        {/* Tides — full width */}
        {forecast?.tides && forecast.tides.length > 0 && (
          <div>
            <SectionTitle>Tides</SectionTitle>
            <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
              <TideChart tides={forecast.tides} selectedDate={activeDayData?.date} />
            </div>
          </div>
        )}

        {/* Swell + Buoy + UV — swell is the anchor */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Swell panel — always shown when current conditions available */}
          {current && (
            <div className="md:row-span-1">
              <SectionTitle>
                Swell —{' '}
                <span style={{ fontWeight: 400 }}>{activeDayData ? format(parseISO(activeDayData.date), 'EEE, MMM d') : 'Now'}</span>
              </SectionTitle>
              <SwellPanel current={current} activeDayData={activeDayData} />
            </div>
          )}

          {forecast?.buoy && spot.noaaBuoyId && (
            <div>
              <SectionTitle>Live Buoy Data</SectionTitle>
              <BuoyReadings buoy={forecast.buoy} buoyId={spot.noaaBuoyId} />
            </div>
          )}

          {activeDayData && (
            <div>
              <SectionTitle>
                UV Index —{' '}
                <span style={{ fontWeight: 400 }}>{format(parseISO(activeDayData.date), 'EEE, MMM d')}</span>
              </SectionTitle>
              <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
                <UVChart activeDayData={activeDayData} />
              </div>
            </div>
          )}
        </div>

        {/* Gear + Community Reports — side by side */}
        <div className="grid gap-4 md:grid-cols-2">
          {activeDayData && (() => {
            const waterHours = activeDayData.hours.filter((h) => h.waterTemp !== null)
            const avgWaterTempC = waterHours.length > 0
              ? waterHours.reduce((sum, h) => sum + (h.waterTemp ?? 0), 0) / waterHours.length
              : null
            return (
              <div>
                <SectionTitle>Gear Recommendations</SectionTitle>
                <GearPanel activeDayHours={activeDayData.hours} waterTempC={avgWaterTempC} />
              </div>
            )
          })()}
          <div>
            <SectionTitle>Community Reports</SectionTitle>
            <SurfReports spotSlug={spot.slug} />
          </div>
        </div>

        {/* Season Calendar */}
        <div>
          <SectionTitle>Best Season to Surf</SectionTitle>
          <SeasonCalendar region={spot.region} difficulty={spot.difficulty} />
        </div>

      </div>
    </div>
  )
}


function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-2 font-semibold text-sm"
      style={{ color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.03em', textTransform: 'uppercase' }}
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
