'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useRef, useEffect, useMemo } from 'react'
import type { SurfSpot } from '@/types/spot'
import type { SpotForecast, ConditionRating, ForecastDay, ForecastHour } from '@/types/forecast'
import { degreesToCompass } from '@/lib/forecast/rating'
import { weatherIcon, tempF } from '@/lib/forecast/weather-code'
import { WaveLoader } from '@/components/layout/WaveLoader'

// ── Fuzzy search ──────────────────────────────────────────────────────────────

function fuzzyScore(query: string, spot: SurfSpot): number {
  const q = query.toLowerCase().trim()
  if (!q) return 1

  const name   = spot.name.toLowerCase()
  const region = spot.region.toLowerCase()
  const full   = `${name} ${region}`

  if (name.startsWith(q))   return 300
  if (name.includes(q))     return 280 - name.indexOf(q)
  if (region.includes(q))   return 200

  const tWords = full.split(/[\s,·\-/]+/)
  const qWords = q.split(/\s+/)
  let wordScore = 0
  for (const qw of qWords) {
    let best = 0
    for (const tw of tWords) {
      if (tw.startsWith(qw))  best = Math.max(best, 80)
      else if (tw.includes(qw)) best = Math.max(best, 50)
    }
    wordScore += best
  }
  if (wordScore > 0) return wordScore

  let qi = 0, lastTi = -1, charScore = 0
  for (let ti = 0; ti < full.length && qi < q.length; ti++) {
    if (full[ti] === q[qi]) {
      const gap = lastTi === -1 ? 0 : ti - lastTi - 1
      charScore += Math.max(1, 20 - gap * 4)
      lastTi = ti
      qi++
    }
  }
  if (qi < q.length) return 0
  return charScore
}

// ── Shared style maps ─────────────────────────────────────────────────────────

const RATING_STYLES: Record<ConditionRating, { bg: string; border: string; text: string; accent: string }> = {
  poor: { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', accent: '#9ca3af' },
  fair: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', accent: '#f59e0b' },
  good: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', accent: '#16a34a' },
  epic: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', accent: '#7c3aed' },
}

const DIFFICULTY_STYLES: Record<string, { color: string; bg: string }> = {
  beginner:     { color: '#15803d', bg: '#f0fdf4' },
  intermediate: { color: '#b45309', bg: '#fffbeb' },
  advanced:     { color: '#b91c1c', bg: '#fef2f2' },
}

const DAY_RATING_ACCENT: Record<ConditionRating, string> = {
  poor: '#9ca3af',
  fair: '#f59e0b',
  good: '#16a34a',
  epic: '#7c3aed',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function metersToFeet(m: number): string {
  return `${Math.round(m * 3.281)}ft`
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SpotSearchInputProps {
  index: number
  value: string
  spots: SurfSpot[]
  onChange: (slug: string) => void
  isLoading: boolean
}

function SpotSearchInput({ index, value, spots, onChange, isLoading }: SpotSearchInputProps) {
  const selectedSpot  = spots.find((s) => s.slug === value) ?? null
  const [query, setQuery]             = useState('')
  const [open, setOpen]               = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef    = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  const results = useMemo((): SurfSpot[] => {
    if (!query.trim()) return spots
    return spots
      .map((s) => ({ spot: s, score: fuzzyScore(query, s) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => x.spot)
  }, [query, spots])

  const handleSelect = (spot: SurfSpot) => { onChange(spot.slug); setQuery(''); setOpen(false) }
  const handleClear = (e: React.SyntheticEvent) => { e.stopPropagation(); e.preventDefault(); onChange(''); setQuery(''); setOpen(false) }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key !== 'Tab') setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[highlighted]) handleSelect(results[highlighted]) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  useEffect(() => { setHighlighted(0) }, [query])

  const isSelected = !!value

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
        Spot {index + 1}
      </label>
      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={isSelected ? 'var(--ocean-500)' : 'var(--text-3)'} strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          disabled={isLoading}
          placeholder={isSelected ? selectedSpot!.name : 'Search spots…'}
          value={open ? query : (isSelected ? selectedSpot!.name : '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="w-full rounded-xl pl-9 pr-9 py-3 text-sm font-medium focus:outline-none transition-all"
          style={{
            background: isSelected && !open ? 'var(--ocean-50)' : 'var(--sand-100)',
            border: `1.5px solid ${isSelected ? 'var(--ocean-300)' : open ? 'var(--ocean-400)' : 'var(--border)'}`,
            color: 'var(--text)',
          }}
        />
        {isSelected ? (
          <button onPointerDown={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full w-4 h-4 transition-colors hover:bg-[var(--sand-200)]"
            style={{ color: 'var(--text-3)' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        ) : (
          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
        {open && (
          <div className="absolute left-0 mt-1.5 rounded-xl overflow-hidden"
            style={{ background: 'white', border: '1.5px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '260px', overflowY: 'auto', zIndex: 9999, minWidth: '260px', width: 'max-content', maxWidth: '90vw' }}
          >
            {isLoading ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-3)' }}>Loading spots…</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-3)' }}>No spots found for &ldquo;{query}&rdquo;</div>
            ) : (
              results.map((spot, i) => (
                <button key={spot.slug} type="button"
                  onPointerDown={(e) => { e.preventDefault(); handleSelect(spot) }}
                  onMouseEnter={() => setHighlighted(i)}
                  className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors"
                  style={{ background: i === highlighted ? 'var(--ocean-50)' : spot.slug === value ? 'var(--sand-50)' : 'white', borderTop: i > 0 ? '1px solid var(--sand-100)' : 'none' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{spot.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{spot.region}</p>
                  </div>
                  {spot.slug === value && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ocean-500)" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Day picker card ───────────────────────────────────────────────────────────

function MiniDayCard({ day, isSelected, onClick }: { day: ForecastDay; isSelected: boolean; onClick: () => void }) {
  const accent = DAY_RATING_ACCENT[day.dominantRating]
  const rs = RATING_STYLES[day.dominantRating]
  return (
    <button type="button" onClick={onClick}
      className="flex flex-col items-center rounded-xl py-2 px-1.5 shrink-0 w-[50px] transition-all"
      style={{ background: isSelected ? accent : rs.bg, border: `1.5px solid ${isSelected ? accent : rs.border}`, boxShadow: isSelected ? `0 2px 8px ${accent}44` : 'none', cursor: 'pointer' }}
    >
      <span className="text-xs font-semibold mb-1" style={{ color: isSelected ? 'white' : 'var(--text-3)' }}>{shortDay(day.date)}</span>
      <span className="text-xs font-bold" style={{ color: isSelected ? 'white' : 'var(--text)' }}>{metersToFeet(day.maxWaveHeight)}</span>
      <span className="mt-1 text-xs font-semibold uppercase" style={{ color: isSelected ? 'rgba(255,255,255,0.85)' : accent, fontSize: '9px', letterSpacing: '0.04em' }}>
        {day.dominantRating}
      </span>
    </button>
  )
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="font-bold text-lg" style={{ color: 'var(--text)', lineHeight: 1 }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>}
    </div>
  )
}

// ── Peak hour helper ──────────────────────────────────────────────────────────

function getPeakHour(day: ForecastDay): ForecastHour | null {
  if (!day.hours.length) return null
  const pool = day.hours.filter((h) => { const hr = new Date(h.time).getHours(); return hr >= 7 && hr <= 17 })
  const src = pool.length > 0 ? pool : day.hours
  return src.reduce((best, h) => h.ratingScore > best.ratingScore ? h : best, src[0])
}

// ── Spot column ───────────────────────────────────────────────────────────────

interface SpotColumnProps {
  spot: SurfSpot
  forecast: SpotForecast | undefined
  isLoading: boolean
  isError: boolean
  selectedDay: string | null
  onDayChange: (date: string) => void
  isExpanded: boolean
  onExpandToggle: () => void
}

function SpotColumn({ spot, forecast, isLoading, isError, selectedDay, onDayChange, isExpanded, onExpandToggle }: SpotColumnProps) {
  const diffStyle = DIFFICULTY_STYLES[spot.difficulty] ?? DIFFICULTY_STYLES.intermediate
  const days = forecast?.forecast ?? []
  const activeDayObj = days.find((d) => d.date === selectedDay) ?? days[0] ?? null
  const peakHour = activeDayObj ? getPeakHour(activeDayObj) : null
  const displayHour = peakHour ?? forecast?.currentCondition ?? null
  const ratingStyle = displayHour ? RATING_STYLES[displayHour.rating] : RATING_STYLES.poor
  const waterTempC = displayHour?.waterTemp ?? forecast?.buoy?.waterTemp ?? null
  const waterTempF = waterTempC != null ? Math.round((waterTempC * 9) / 5 + 32) : null

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: 'white', border: '1px solid var(--border)', borderTop: '3px solid var(--ocean-400)', minWidth: 0 }}>
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <a href={`/spots/${spot.slug}`} className="font-bold text-base leading-tight hover:underline"
            style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>{spot.name}</a>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
              style={{ background: diffStyle.bg, color: diffStyle.color }}>{spot.difficulty}</span>
            <button type="button" onClick={onExpandToggle}
              className="rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
              style={{ background: isExpanded ? 'var(--ocean-600)' : 'var(--sand-100)', color: isExpanded ? 'white' : 'var(--text-3)', border: '1px solid var(--border)' }}
            >{isExpanded ? '▲ Less' : '▼ More'}</button>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{spot.region}</p>
      </div>

      {days.length > 0 && (
        <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--sand-100)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Select day</p>
          <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {days.map((day) => (
              <MiniDayCard key={day.date} day={day}
                isSelected={(selectedDay ?? days[0]?.date) === day.date}
                onClick={() => onDayChange(day.date)} />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 px-4 py-4 space-y-3">
        {isLoading ? (
          <WaveLoader compact label="Fetching forecast…" />
        ) : isError ? (
          <p className="text-sm text-center py-6" style={{ color: '#ef4444' }}>Failed to load forecast</p>
        ) : !displayHour ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>No data available</p>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: ratingStyle.bg, border: `1px solid ${ratingStyle.border}` }}>
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: ratingStyle.text }}>
                  {activeDayObj ? shortDay(activeDayObj.date) : 'Now'}
                </p>
                <p className="font-black uppercase tracking-wide" style={{ color: ratingStyle.text, fontSize: '18px', fontFamily: 'Playfair Display, serif' }}>
                  {displayHour.rating === 'epic' ? 'EPIC' : displayHour.rating.charAt(0).toUpperCase() + displayHour.rating.slice(1)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium mb-0.5" style={{ color: ratingStyle.text }}>Score</p>
                <p className="text-2xl font-black" style={{ color: ratingStyle.accent }}>{displayHour.ratingScore}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatCell label="Wave Height" value={metersToFeet(displayHour.waveHeight)} sub={`${displayHour.waveHeight.toFixed(1)}m`} />
              <StatCell label="Swell Period" value={`${Math.round(displayHour.swellPeriod)}s`} sub={degreesToCompass(displayHour.swellDirection)} />
              <div className="col-span-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Wind</p>
                <div className="flex items-baseline gap-2">
                  <p className="font-bold text-lg" style={{ color: 'var(--text)', lineHeight: 1 }}>{Math.round(displayHour.wind.speed)} km/h</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{displayHour.wind.directionLabel}</p>
                </div>
              </div>
              <div className="col-span-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Water Temp</p>
                {waterTempF != null ? (
                  <div className="flex items-baseline gap-2">
                    <p className="font-bold text-lg" style={{ color: 'var(--text)', lineHeight: 1 }}>{waterTempF}°F</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{Math.round(waterTempC!)}°C</p>
                  </div>
                ) : (
                  <p className="font-bold text-lg" style={{ color: 'var(--text-3)', lineHeight: 1 }}>—</p>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="space-y-2 pt-1" style={{ borderTop: '1px dashed var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide pt-1" style={{ color: 'var(--text-3)' }}>Full details</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCell label="Swell Height" value={`${Math.round(displayHour.swellHeight * 3.281)}ft`} sub={`${displayHour.swellHeight.toFixed(1)}m`} />
                  <StatCell label="Wave Power" value={`${Math.round(displayHour.wavePower)} kW/m`} />
                  {displayHour.wind.gust > 0 && <StatCell label="Wind Gust" value={`${Math.round(displayHour.wind.gust)} km/h`} />}
                  {displayHour.uvIndex > 0 && <StatCell label="UV Index" value={displayHour.uvIndex.toFixed(1)} />}
                  {displayHour.airTempC != null && <StatCell label="Air Temp" value={`${Math.round(displayHour.airTempC * 9/5 + 32)}°F`} sub={`${Math.round(displayHour.airTempC)}°C`} />}
                  {displayHour.precipProb != null && <StatCell label="Rain Chance" value={`${displayHour.precipProb}%`} />}
                </div>
                {activeDayObj && activeDayObj.hours.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ background: 'var(--sand-100)', color: 'var(--text-3)' }}>
                      Hourly — {shortDay(activeDayObj.date)}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--sand-50)' }}>
                            {['Time', 'Waves', 'Period', 'Wind', 'Wthr', 'Temp', 'Rating'].map((h) => (
                              <th key={h} className="px-2 py-1.5 text-left font-semibold" style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeDayObj.hours.filter((_, i) => i % 2 === 0).slice(0, 8).map((h) => {
                            const rs = RATING_STYLES[h.rating]
                            const hr = new Date(h.time).getHours()
                            const disp = `${hr === 0 ? 12 : hr > 12 ? hr - 12 : hr}${hr < 12 ? 'am' : 'pm'}`
                            return (
                              <tr key={h.time} style={{ borderBottom: '1px solid var(--sand-100)' }}>
                                <td className="px-2 py-2 font-medium" style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{disp}</td>
                                <td className="px-2 py-2 font-bold" style={{ color: 'var(--text)' }}>{metersToFeet(h.waveHeight)}</td>
                                <td className="px-2 py-2" style={{ color: 'var(--text-2)' }}>{Math.round(h.swellPeriod)}s</td>
                                <td className="px-2 py-2 whitespace-nowrap" style={{ color: 'var(--text-2)' }}>{Math.round(h.wind.speed)} {h.wind.directionLabel}</td>
                                <td className="px-2 py-2" style={{ fontSize: 14, lineHeight: 1 }}>{h.weatherCode !== null ? weatherIcon(h.weatherCode) : '—'}</td>
                                <td className="px-2 py-2 whitespace-nowrap" style={{ color: 'var(--text-2)' }}>{tempF(h.airTempC)}</td>
                                <td className="px-2 py-2">
                                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize" style={{ background: rs.bg, color: rs.text, border: `1px solid ${rs.border}` }}>{h.rating}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Spot forecast hook ────────────────────────────────────────────────────────

function useSpotForecast(slug: string) {
  return useQuery<SpotForecast>({
    queryKey: ['forecast', slug],
    queryFn: async () => {
      const r = await fetch(`/api/forecast/${slug}`)
      if (!r.ok) throw new Error(`forecast ${r.status}`)
      return r.json()
    },
    enabled: !!slug,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })
}

// ── Connected column wrapper ──────────────────────────────────────────────────

function ConnectedSpotColumn({ slug, spots, selectedDay, onDayChange, isExpanded, onExpandToggle }: {
  slug: string; spots: SurfSpot[]; selectedDay: string | null
  onDayChange: (d: string) => void; isExpanded: boolean; onExpandToggle: () => void
}) {
  const { data: forecast, isLoading, isError } = useSpotForecast(slug)
  const spot = spots.find((s) => s.slug === slug)
  if (!spot) return null
  return (
    <SpotColumn spot={spot} forecast={forecast} isLoading={isLoading} isError={isError}
      selectedDay={selectedDay} onDayChange={onDayChange}
      isExpanded={isExpanded} onExpandToggle={onExpandToggle} />
  )
}

// ── Mobile swipe container ────────────────────────────────────────────────────

function MobileSwipeCompare({ activeSlugs, spots, selectedDays, setSelectedDays, expandedSlugs, setExpandedSlugs }: {
  activeSlugs: string[]
  spots: SurfSpot[]
  selectedDays: Record<string, string>
  setSelectedDays: React.Dispatch<React.SetStateAction<Record<string, string>>>
  expandedSlugs: Set<string>
  setExpandedSlugs: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const [idx, setIdx] = useState(0)
  const touchStartX = useRef<number | null>(null)

  // Clamp idx when slugs change
  useEffect(() => {
    setIdx((i) => Math.min(i, activeSlugs.length - 1))
  }, [activeSlugs.length])

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (delta < -50 && idx < activeSlugs.length - 1) setIdx((i) => i + 1)
    if (delta > 50  && idx > 0)                       setIdx((i) => i - 1)
  }

  const slug = activeSlugs[idx]

  return (
    <div>
      {/* Swipe area */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        <ConnectedSpotColumn
          key={slug}
          slug={slug}
          spots={spots}
          selectedDay={selectedDays[slug] ?? null}
          onDayChange={(date) => setSelectedDays((prev) => ({ ...prev, [slug]: date }))}
          isExpanded={expandedSlugs.has(slug)}
          onExpandToggle={() => setExpandedSlugs((prev) => {
            const next = new Set(prev)
            next.has(slug) ? next.delete(slug) : next.add(slug)
            return next
          })}
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4 px-1">
        <button
          onClick={() => setIdx((i) => Math.max(i - 1, 0))}
          disabled={idx === 0}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-30"
          style={{ background: 'var(--sand-100)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
        >
          ← Prev
        </button>

        {/* Dot indicators */}
        <div className="flex gap-2 items-center">
          {activeSlugs.map((s, i) => {
            const spot = spots.find((sp) => sp.slug === s)
            return (
              <button key={s} onClick={() => setIdx(i)}
                className="flex flex-col items-center gap-1"
                title={spot?.name}
              >
                <div
                  className="rounded-full transition-all"
                  style={{
                    width: i === idx ? 10 : 7,
                    height: i === idx ? 10 : 7,
                    background: i === idx ? 'var(--ocean-600)' : 'var(--border)',
                  }}
                />
                {spot && (
                  <span className="text-xs font-medium" style={{ color: i === idx ? 'var(--ocean-600)' : 'var(--text-3)', fontSize: 10 }}>
                    {spot.name.split(' ')[0]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setIdx((i) => Math.min(i + 1, activeSlugs.length - 1))}
          disabled={idx === activeSlugs.length - 1}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-30"
          style={{ background: 'var(--sand-100)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const MAX_SPOTS = 3
const STORAGE_KEY = 'wavefinder-compare-slugs'

export default function ComparePage() {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(['', '', ''])
  const [selectedDays, setSelectedDays]   = useState<Record<string, string>>({})
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const SLUG_RE = /^[a-z0-9-]{1,120}$/
        if (Array.isArray(parsed) && parsed.length === MAX_SPOTS &&
            parsed.every((s) => typeof s === 'string' && (s === '' || SLUG_RE.test(s))))
          setSelectedSlugs(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  const { data: spots = [], isLoading: spotsLoading } = useQuery<SurfSpot[]>({
    queryKey: ['spots-all'],
    queryFn: () => fetch('/api/spots?limit=200').then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
  })

  const activeSlugs = selectedSlugs.filter(Boolean)
  const hasComparison = activeSlugs.length >= 2

  function handleSlugChange(index: number, slug: string) {
    setSelectedSlugs((prev) => {
      const next = [...prev]
      next[index] = slug
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--sand-50)' }}>
      {/* Page header */}
      <div className="sticky top-[57px] z-40 border-b" style={{ background: 'var(--sand-50)', borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-5 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold leading-tight"
                  style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
                  Compare Spots
                </h1>
                <p className="hidden sm:block text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Compare conditions across multiple breaks
                </p>
              </div>
            </div>
            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {Array.from({ length: MAX_SPOTS }).map((_, i) => (
                <SpotSearchInput key={i} index={i} value={selectedSlugs[i]} spots={spots}
                  onChange={(slug) => handleSlugChange(i, slug)} isLoading={spotsLoading} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-5 py-8">
        {!hasComparison ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: 'var(--ocean-50)', border: '2px solid var(--ocean-200)' }}>
              <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
                <path d="M2 15 C6 10 10 8 14 11 C18 14 20 9 24 8 C28 7 32 10 36 12 C38 13 40 13.5 40 13.5"
                  stroke="var(--ocean-400)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M2 22 C6 18 10 17 14 19 C18 21 20 17.5 24 16.5 C28 15.5 32 17.5 36 19"
                  stroke="var(--seafoam)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              Select at least 2 spots to compare
            </h2>
            <p className="text-sm max-w-sm" style={{ color: 'var(--text-3)' }}>
              Choose spots from the dropdowns above to see their conditions and 7-day forecasts side by side.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: swipe one at a time */}
            <div className="sm:hidden">
              <MobileSwipeCompare
                activeSlugs={activeSlugs}
                spots={spots}
                selectedDays={selectedDays}
                setSelectedDays={setSelectedDays}
                expandedSlugs={expandedSlugs}
                setExpandedSlugs={setExpandedSlugs}
              />
            </div>

            {/* Desktop: side-by-side grid */}
            <div className={`hidden sm:grid gap-5 ${
              activeSlugs.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {activeSlugs.map((slug) => (
                <ConnectedSpotColumn key={slug} slug={slug} spots={spots}
                  selectedDay={selectedDays[slug] ?? null}
                  onDayChange={(date) => setSelectedDays((prev) => ({ ...prev, [slug]: date }))}
                  isExpanded={expandedSlugs.has(slug)}
                  onExpandToggle={() => setExpandedSlugs((prev) => {
                    const next = new Set(prev)
                    next.has(slug) ? next.delete(slug) : next.add(slug)
                    return next
                  })}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
