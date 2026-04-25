'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { SpotCard } from '@/components/spots/SpotCard'
import { WaveLoader } from '@/components/layout/WaveLoader'
import type { SurfSpot } from '@/types/spot'
import type { ConditionRating } from '@/types/forecast'
import {
  getStatesForCountry,
  getRegionsForState,
  getAllRegionsForCountry,
} from '@/lib/region-hierarchy'

interface SpotWithRating extends SurfSpot {
  currentRating?: ConditionRating | 'unknown'
  currentWaveHeight?: number | null
  currentPeriod?: number | null
  currentWindSpeed?: number | null
  wavePower?: number | null
}

const SpotMap = dynamic(
  () => import('@/components/spots/SpotMap').then((m) => m.SpotMap),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center" style={{ background: 'var(--sand-50)' }}><WaveLoader compact label="Loading map…" /></div> }
)

type ViewMode = 'map' | 'list'

// ── Region map centers ────────────────────────────────────────────────────────

const REGION_MAP_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'San Diego':     { lat: 32.85, lng: -117.27, zoom: 11 },
  'Orange County': { lat: 33.55, lng: -117.75, zoom: 11 },
  'Los Angeles':   { lat: 33.95, lng: -118.42, zoom: 11 },
  'Ventura':       { lat: 34.25, lng: -119.25, zoom: 10 },
  'Santa Barbara': { lat: 34.42, lng: -119.70, zoom: 11 },
  'Central Coast': { lat: 35.30, lng: -120.80, zoom: 10 },
  'Monterey':      { lat: 36.85, lng: -121.95, zoom: 10 },
  'NorCal':        { lat: 38.50, lng: -123.00, zoom: 8  },
}

const COUNTRY_MAP_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'USA':            { lat: 37.0,  lng: -119.5, zoom: 5 },
  'Australia':      { lat: -27.0, lng: 133.0,  zoom: 4 },
  'Indonesia':      { lat: -4.0,  lng: 117.0,  zoom: 5 },
  'Portugal':       { lat: 39.5,  lng: -8.0,   zoom: 6 },
  'Spain':          { lat: 40.0,  lng: -3.5,   zoom: 5 },
  'France':         { lat: 46.0,  lng: 2.0,    zoom: 6 },
  'South Africa':   { lat: -29.0, lng: 26.0,   zoom: 5 },
  'Brazil':         { lat: -14.0, lng: -51.0,  zoom: 4 },
  'Japan':          { lat: 36.0,  lng: 138.0,  zoom: 5 },
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SpotsPage() {
  const [search, setSearch]           = useState('')
  const [difficulty, setDifficulty]   = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedState, setSelectedState]     = useState('')
  const [selectedRegion, setSelectedRegion]   = useState('')
  const [view, setView] = useState<ViewMode>('map')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState<'idle' | 'loading' | 'located' | 'error'>('idle')
  const searchParams = useSearchParams()

  function handleLocate() {
    if (locating === 'loading') return
    if (!navigator.geolocation) {
      setLocating('error')
      setTimeout(() => setLocating('idle'), 3000)
      return
    }
    setLocating('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating('located')
      },
      () => {
        setLocating('error')
        setTimeout(() => setLocating('idle'), 3000)
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  // Pre-populate from ?region= URL param (from /regions page links)
  useEffect(() => {
    const region = searchParams.get('region')
    if (region) {
      setSelectedRegion(region)
      setView('list')
    }
    const country = searchParams.get('country')
    if (country) setSelectedCountry(country)
  }, [searchParams])

  // Fetch distinct countries from DB
  const { data: metaData } = useQuery<{ countries: string[] }>({
    queryKey: ['spots-meta-countries'],
    queryFn: () => fetch('/api/spots/meta').then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
  })
  const dbCountries = metaData?.countries ?? []

  // Derived state/region options from hierarchy
  const availableStates  = selectedCountry ? getStatesForCountry(selectedCountry) : []
  const availableRegions = selectedState
    ? getRegionsForState(selectedCountry, selectedState)
    : selectedCountry
      ? getAllRegionsForCountry(selectedCountry)
      : []

  // Reset dependent selectors when parent changes
  const handleCountryChange = (c: string) => {
    setSelectedCountry(c)
    setSelectedState('')
    setSelectedRegion('')
    setSearch('')
  }
  const handleStateChange = (s: string) => {
    setSelectedState(s)
    setSelectedRegion('')
    setSearch('')
  }
  const handleRegionChange = (r: string) => {
    setSelectedRegion(r)
    setSearch('')
  }

  // Build API params
  const apiParams = new URLSearchParams()
  const effectiveSearch = search || selectedRegion
  if (effectiveSearch)    apiParams.set('q', effectiveSearch)
  if (difficulty)         apiParams.set('difficulty', difficulty)
  if (selectedCountry)    apiParams.set('country', selectedCountry)

  // Stage 1: base spots
  const { data: baseSpots = [], isLoading } = useQuery<SpotWithRating[]>({
    queryKey: ['spots', effectiveSearch, difficulty, selectedCountry],
    queryFn: () => fetch(`/api/spots?${apiParams}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }),
    staleTime: 30 * 60 * 1000,
  })

  // Stage 2: live conditions
  const condParams = new URLSearchParams(apiParams)
  condParams.set('withConditions', 'true')
  const { data: conditionData } = useQuery<SpotWithRating[]>({
    queryKey: ['spots-conditions', effectiveSearch, difficulty, selectedCountry],
    queryFn: () => fetch(`/api/spots?${condParams}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }),
    staleTime: 0,
    gcTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
    enabled: baseSpots.length > 0,
  })

  const spots = useMemo(() => {
    if (!conditionData || !Array.isArray(conditionData)) return baseSpots
    const condMap = new Map(conditionData.map((s) => [s.id, s]))
    return baseSpots.map((s) => ({ ...s, ...condMap.get(s.id) }))
  }, [baseSpots, conditionData])

  // Map center
  const mapCenter = useMemo(() => {
    if (selectedRegion && REGION_MAP_CENTERS[selectedRegion]) return REGION_MAP_CENTERS[selectedRegion]
    if (selectedCountry && COUNTRY_MAP_CENTERS[selectedCountry]) return COUNTRY_MAP_CENTERS[selectedCountry]
    return { lat: 36.5, lng: -120.5, zoom: 7 }
  }, [selectedRegion, selectedCountry])

  const conditionsSummary = useMemo(() => {
    if (!spots.length) return null
    const withData = spots.filter(s => s.currentRating && s.currentRating !== 'unknown')
    if (!withData.length) return null
    const counts = { epic: 0, good: 0, fair: 0, poor: 0 }
    withData.forEach(s => { counts[s.currentRating as keyof typeof counts] = (counts[s.currentRating as keyof typeof counts] ?? 0) + 1 })
    return counts
  }, [spots])

  const hasFilter = !!(selectedCountry || selectedState || selectedRegion || search)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 57px)' }}>
      {/* Top bar */}
      <div
        className="shrink-0 px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'white' }}
      >
        <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative w-full sm:flex-1 sm:min-w-0 sm:max-w-[180px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2"
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-3)" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search spots..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedCountry(''); setSelectedState(''); setSelectedRegion('') }}
              className="w-full rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none"
              style={{ background: 'var(--sand-100)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          {/* Country dropdown */}
          <div className="relative">
            <select
              value={selectedCountry}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="rounded-lg pl-3 pr-7 py-2 text-xs font-medium focus:outline-none h-9 appearance-none cursor-pointer"
              style={{
                background: selectedCountry ? 'var(--ocean-600)' : 'var(--sand-100)',
                border: `1px solid ${selectedCountry ? 'var(--ocean-600)' : 'var(--border)'}`,
                color: selectedCountry ? 'white' : 'var(--text-2)',
              }}
            >
              <option value="">Country</option>
              {dbCountries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={selectedCountry ? 'white' : 'var(--text-3)'} strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>

          {/* State/Province dropdown — only when country has states */}
          {availableStates.length > 0 && (
            <div className="relative">
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                className="rounded-lg pl-3 pr-7 py-2 text-xs font-medium focus:outline-none h-9 appearance-none cursor-pointer"
                style={{
                  background: selectedState ? 'var(--ocean-500)' : 'var(--sand-100)',
                  border: `1px solid ${selectedState ? 'var(--ocean-500)' : 'var(--border)'}`,
                  color: selectedState ? 'white' : 'var(--text-2)',
                }}
              >
                <option value="">State / Province</option>
                {availableStates.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={selectedState ? 'white' : 'var(--text-3)'} strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          )}

          {/* Region dropdown — shown when state or country is selected */}
          {availableRegions.length > 0 && (
            <div className="relative">
              <select
                value={selectedRegion}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="rounded-lg pl-3 pr-7 py-2 text-xs font-medium focus:outline-none h-9 appearance-none cursor-pointer"
                style={{
                  background: selectedRegion ? 'var(--ocean-400)' : 'var(--sand-100)',
                  border: `1px solid ${selectedRegion ? 'var(--ocean-400)' : 'var(--border)'}`,
                  color: selectedRegion ? 'white' : 'var(--text-2)',
                }}
              >
                <option value="">Region</option>
                {availableRegions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={selectedRegion ? 'white' : 'var(--text-3)'} strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          )}

          {/* Clear filters */}
          {hasFilter && (
            <button
              onClick={() => { setSelectedCountry(''); setSelectedState(''); setSelectedRegion(''); setSearch('') }}
              className="rounded-lg px-3 py-2 text-xs font-medium transition-colors h-9"
              style={{ background: 'var(--sand-100)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
            >
              ✕ Clear
            </button>
          )}

          {/* Difficulty */}
          <div className="relative">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="rounded-lg pl-3 pr-7 py-2 text-xs font-medium focus:outline-none h-9 appearance-none cursor-pointer"
              style={{ background: 'var(--sand-100)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              <option value="">All levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>

          {/* View toggle */}
          <div
            className="flex rounded-lg overflow-hidden ml-auto"
            style={{ border: '1px solid var(--border)' }}
          >
            {(['map', 'list'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-2 text-xs font-medium transition-colors capitalize"
                style={{
                  background: view === v ? 'var(--ocean-600)' : 'white',
                  color: view === v ? 'white' : 'var(--text-2)',
                }}
              >
                {v === 'map' ? '🗺️ Map' : '☰ List'}
              </button>
            ))}
          </div>

          {/* Count */}
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
            {isLoading ? '…' : `${spots.length} spots`}
          </span>
        </div>
      </div>

      {/* Main content */}
      {view === 'map' ? (
        <div className="flex-1 relative overflow-hidden">
          <SpotMap
            spots={spots}
            centerLat={mapCenter.lat}
            centerLng={mapCenter.lng}
            zoom={mapCenter.zoom}
            userLocation={userLocation}
          />

          {/* Condition summary bar */}
          {conditionsSummary && (
            <div
              className="absolute top-3 right-3 z-[1000] rounded-xl px-4 py-2.5 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
            >
              <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Live:</span>
              {conditionsSummary.epic > 0 && (
                <span className="text-xs font-bold" style={{ color: '#7c3aed' }}>⚡ {conditionsSummary.epic} Epic</span>
              )}
              {conditionsSummary.good > 0 && (
                <span className="text-xs font-bold" style={{ color: '#16a34a' }}>✓ {conditionsSummary.good} Good</span>
              )}
              {conditionsSummary.fair > 0 && (
                <span className="text-xs font-semibold" style={{ color: '#b45309' }}>{conditionsSummary.fair} Fair</span>
              )}
              {conditionsSummary.poor > 0 && (
                <span className="text-xs" style={{ color: '#6b7280' }}>{conditionsSummary.poor} Poor</span>
              )}
            </div>
          )}

          {/* Legend overlay */}
          <div
            className="absolute bottom-5 left-5 z-[1000] rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-2)' }}>Conditions</p>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Poor',  color: '#9ca3af', bg: '#f3f4f6' },
                { label: 'Fair',  color: '#f59e0b', bg: '#fef3c7' },
                { label: 'Good',  color: '#16a34a', bg: '#d1fae5' },
                { label: 'EPIC',  color: '#7c3aed', bg: '#ede9fe' },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: r.bg, border: `2px solid ${r.color}`, color: r.color, fontSize: '7px', fontWeight: 700 }}
                  >
                    {r.label[0]}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-2)' }}>{r.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1 pt-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: '#f3f4f6', border: '2px solid #d1d5db', color: '#9ca3af', fontSize: '7px', fontWeight: 700 }}
                >
                  ?
                </div>
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>No live data</span>
              </div>
            </div>
          </div>

          {/* Locate me button */}
          <button
            onClick={handleLocate}
            title={locating === 'located' ? 'Re-center on my location' : 'Show my location'}
            className="absolute bottom-5 right-5 z-[1000] w-10 h-10 rounded-xl flex items-center justify-center transition-all"
            style={{
              background:   locating === 'located' ? 'var(--ocean-600)' : locating === 'error' ? '#fef2f2' : 'white',
              border:       `2px solid ${locating === 'located' ? 'var(--ocean-600)' : locating === 'error' ? '#fca5a5' : 'var(--border)'}`,
              color:        locating === 'located' ? 'white' : locating === 'error' ? '#ef4444' : 'var(--text-2)',
              boxShadow:    '0 2px 12px rgba(0,0,0,0.12)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {locating === 'loading' ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--sand-200)] border-t-[var(--ocean-600)]" />
            ) : locating === 'error' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill={locating === 'located' ? 'white' : 'none'} stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="8"/>
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
              </svg>
            )}
          </button>

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-[999]">
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text-2)' }}
              >
                Loading spots…
              </div>
            </div>
          )}
          {!isLoading && !conditionData && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[999]">
              <div
                className="rounded-xl px-4 py-2.5 text-xs flex items-center gap-2"
                style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text-3)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              >
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--sand-200)] border-t-[var(--ocean-600)]" />
                Fetching live conditions…
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List view */
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="mx-auto max-w-6xl">
            {isLoading ? (
              <WaveLoader compact label="Loading spots…" />
            ) : spots.length === 0 ? (
              <div className="py-20 text-center" style={{ color: 'var(--text-3)' }}>
                No spots match your filters.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {spots.map((spot) => (
                  <SpotCard
                    key={spot.id}
                    spot={spot}
                    rating={spot.currentRating && spot.currentRating !== 'unknown' ? spot.currentRating as ConditionRating : undefined}
                    waveHeight={spot.currentWaveHeight ?? undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
