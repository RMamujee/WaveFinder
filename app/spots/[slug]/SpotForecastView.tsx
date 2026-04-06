'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import type { SurfSpot } from '@/types/spot'
import type { SpotForecast, ForecastDay, ConditionRating } from '@/types/forecast'
import { WaveChart } from '@/components/forecast/WaveChart'
import { WindChart } from '@/components/forecast/WindChart'
import { TideChart } from '@/components/forecast/TideChart'
import { ForecastDayCard } from '@/components/forecast/ForecastDayCard'
import { BuoyReadings } from '@/components/forecast/BuoyReadings'
import { WebcamPanel } from '@/components/webcam/WebcamPanel'
import { SaveSpotButton } from '@/components/spots/SaveSpotButton'
import { SurfReports } from '@/components/forecast/SurfReports'
import { BestTimePanel } from '@/components/forecast/BestTimePanel'
import { computeBestTimes } from '@/lib/forecast/best-time'
import { degreesToCompass } from '@/lib/forecast/rating'
import { SeasonCalendar } from '@/components/spots/SeasonCalendar'
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
    return computeBestTimes(activeDayData.hours)
  }, [activeDayData])

  const diffStyle = DIFFICULTY_STYLES[spot.difficulty as keyof typeof DIFFICULTY_STYLES]

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

          <div className="flex flex-wrap items-start justify-between gap-6">
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

              {isLoading ? (
                <div className="flex gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 w-24 animate-pulse rounded-xl" style={{ background: 'var(--sand-200)' }} />
                  ))}
                </div>
              ) : current ? (
                <div className="flex flex-wrap items-end gap-6">
                  {/* Wave height */}
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>Wave Height</p>
                    <div className="flex items-baseline gap-1.5">
                      <span style={{ fontSize: '38px', fontWeight: 700, color: 'var(--text)', lineHeight: 1, fontFamily: 'Playfair Display, serif' }}>
                        {metersToFeet(current.waveHeight)}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text-3)' }}>{current.waveHeight}m</span>
                    </div>
                  </div>

                  {/* Period */}
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>Period</p>
                    <div className="flex items-baseline gap-1">
                      <span style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>
                        {Math.round(current.swellPeriod)}s
                      </span>
                    </div>
                  </div>

                  {/* Direction */}
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>Swell</p>
                    <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text)' }}>
                      {degreesToCompass(current.swellDirection)}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{current.swellDirection}°</p>
                  </div>

                  {/* Wind */}
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>Wind</p>
                    <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text)' }}>
                      {Math.round(current.wind.speed)} km/h
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{current.wind.directionLabel}</p>
                  </div>

                  {/* Wave Power */}
                  {current.wavePower > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>Power</p>
                      <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text)' }}>
                        {current.wavePower}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>kW/m</p>
                    </div>
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
      <div className="mx-auto max-w-7xl px-5 py-6 space-y-5">

        {/* 7-day strip + webcam */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* 7-day strip */}
          <div className="lg:col-span-2">
            <SectionTitle>7-Day Forecast</SectionTitle>
            {isLoading ? (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-xl" style={{ background: 'var(--sand-100)' }} />
                ))}
              </div>
            ) : forecast?.forecast ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
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

        {/* Best time + hourly table */}
        {forecast?.forecast && activeDayData && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Best Times */}
            <div>
              <SectionTitle>
                Best Times Today
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-3)' }}>
                  {activeDayData ? format(parseISO(activeDayData.date), 'EEE, MMM d') : ''}
                </span>
              </SectionTitle>
              {bestTimes.length > 0 ? (
                <BestTimePanel slots={bestTimes} />
              ) : (
                <div className="rounded-2xl p-8 text-center text-sm" style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  Loading time recommendations…
                </div>
              )}
            </div>

            {/* Hourly breakdown */}
            <div>
              <SectionTitle>
                Hourly —{' '}
                {format(parseISO(activeDayData.date), 'EEEE, MMM d')}
              </SectionTitle>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'white' }}>
                <table className="w-full text-sm">
                  <thead style={{ borderBottom: '1px solid var(--border)', background: 'var(--sand-50)' }}>
                    <tr className="text-left">
                      {['Time', 'Height', 'Period', 'Dir', 'Wind', 'Rating'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                          {h}
                        </th>
                      ))}
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
                            <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                              {format(parseISO(h.time), 'ha')}
                            </td>
                            <td className="px-4 py-3 font-semibold text-xs" style={{ color: 'var(--text)' }}>
                              {metersToFeet(h.waveHeight)}
                              <span className="ml-1 font-normal" style={{ color: 'var(--text-3)', fontSize: '11px' }}>
                                {h.waveHeight}m
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>
                              {Math.round(h.swellPeriod)}s
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
                              {degreesToCompass(h.swellDirection)}
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
                              {Math.round(h.wind.speed)} {h.wind.directionLabel}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-semibold"
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
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Wave chart */}
            <div className="lg:col-span-2">
              <SectionTitle>Wave Height — 7 Days</SectionTitle>
              <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
                <WaveChart days={forecast.forecast} />
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

        {/* Tides */}
        {forecast?.tides && forecast.tides.length > 0 && (
          <div>
            <SectionTitle>Tides</SectionTitle>
            <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
              <TideChart tides={forecast.tides} selectedDate={activeDayData?.date} />
            </div>
          </div>
        )}

        {/* Buoy + UV & Water + community in a grid */}
        <div className="grid gap-5 lg:grid-cols-2">
          {forecast?.buoy && spot.noaaBuoyId && (
            <div>
              <SectionTitle>Live Buoy Data</SectionTitle>
              <BuoyReadings buoy={forecast.buoy} buoyId={spot.noaaBuoyId} />
            </div>
          )}
          {activeDayData && (
            <div>
              <SectionTitle>UV &amp; Water</SectionTitle>
              <UVWaterPanel activeDayData={activeDayData} />
            </div>
          )}
          <div className={forecast?.buoy && spot.noaaBuoyId ? 'lg:col-span-2' : activeDayData ? 'lg:col-span-2' : 'lg:col-span-2'}>
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

function getUVLevel(uv: number): { label: string; color: string; bg: string } {
  if (uv <= 2) return { label: 'Low', color: '#15803d', bg: '#f0fdf4' }
  if (uv <= 5) return { label: 'Moderate', color: '#b45309', bg: '#fffbeb' }
  if (uv <= 7) return { label: 'High', color: '#c2410c', bg: '#fff7ed' }
  if (uv <= 10) return { label: 'Very High', color: '#b91c1c', bg: '#fef2f2' }
  return { label: 'Extreme', color: '#7c3aed', bg: '#f5f3ff' }
}

function UVWaterPanel({ activeDayData }: { activeDayData: ForecastDay }) {
  const peakUV = Math.max(...activeDayData.hours.map((h) => h.uvIndex))
  const waterHours = activeDayData.hours.filter((h) => h.waterTemp !== null)
  const avgWaterTempC = waterHours.length > 0
    ? waterHours.reduce((sum, h) => sum + (h.waterTemp ?? 0), 0) / waterHours.length
    : null
  const avgWaterTempF = avgWaterTempC !== null ? (avgWaterTempC * 9) / 5 + 32 : null

  const uvLevel = getUVLevel(peakUV)
  const uvBarWidth = Math.min((peakUV / 11) * 100, 100)

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'white', border: '1px solid var(--border)' }}
    >
      {/* UV Index row */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>Peak UV Index</span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: uvLevel.bg, color: uvLevel.color }}
          >
            {uvLevel.label}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text)', lineHeight: 1, fontFamily: 'Playfair Display, serif' }}>
            {Math.round(peakUV)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>/ 11+</span>
        </div>
        {/* UV scale bar */}
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--sand-200)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${uvBarWidth}%`,
              background: `linear-gradient(to right, #16a34a, #f59e0b, #f97316, #ef4444, #7c3aed)`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          {['0', '3', '6', '8', '11+'].map((v) => (
            <span key={v} className="text-xs" style={{ color: 'var(--text-3)', fontSize: '10px' }}>{v}</span>
          ))}
        </div>
      </div>

      {/* Water temperature row */}
      {avgWaterTempC !== null && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Avg Water Temperature</p>
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)', lineHeight: 1, fontFamily: 'Playfair Display, serif' }}>
              {Math.round(avgWaterTempC)}°C
            </span>
            <span className="text-sm" style={{ color: 'var(--text-3)' }}>
              {Math.round(avgWaterTempF ?? 0)}°F
            </span>
          </div>
        </div>
      )}

      {avgWaterTempC === null && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Water temperature not available</p>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 font-semibold text-sm"
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
