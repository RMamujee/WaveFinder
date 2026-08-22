'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { SpotCard } from '@/components/spots/SpotCard'
import { WaveLoader } from '@/components/layout/WaveLoader'
import type { MapBounds } from '@/components/spots/SpotMap'
import type { SurfSpot } from '@/types/spot'
import type { ConditionRating } from '@/types/forecast'
import {
  REGION_HIERARCHY,
  getStatesForCountry,
  getRegionsForState,
  getAllRegionsForCountry,
} from '@/lib/region-hierarchy'

interface SpotWithRating extends SurfSpot {
  currentRating?: ConditionRating | 'unknown'
  currentWaveHeight?: number | null
  currentFaceHeight?: number | null
  currentPeriod?: number | null
  currentWindSpeed?: number | null
  wavePower?: number | null
}

const SpotMap = dynamic(
  () => import('@/components/spots/SpotMap').then((m) => m.SpotMap),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center" style={{ background: 'var(--sand-50)' }}><WaveLoader compact label="Loading map…" /></div> }
)

type ViewMode = 'map' | 'list'

// List page size. Also the list view's conditions scope: 48 spots is at most
// 48 coordinate buckets ≈ 96 upstream calls, and stays under the route's
// 50-item ids= cap.
const PAGE_SIZE = 48

// Viewport → query key, rounded outward and padded so nudging the map re-uses
// the cached payload. Mirrors LiveMapHero; see the header on parseBbox in
// app/api/spots/route.ts for why the map must not ask for the whole world.
const BBOX_PAD_DEG = 1

function bboxParam(b: MapBounds): string {
  const lo = (n: number) => Math.floor(n) - BBOX_PAD_DEG
  const hi = (n: number) => Math.ceil(n) + BBOX_PAD_DEG
  // Wrap longitudes into [-180, 180]: Leaflet reports bounds past the edge of
  // the world after a dateline pan, and -182 vs 178 are the same geography but
  // two distinct CDN cache keys — each one a fresh origin fan-out. The server
  // matches a wrapped box (minLng > maxLng) as a union of two spans.
  const wrapLng = (n: number) => ((((n + 180) % 360) + 360) % 360) - 180
  const minLng = lo(b.minLng)
  const maxLng = hi(b.maxLng)
  const wide = maxLng - minLng >= 360
  return [
    Math.max(lo(b.minLat), -90),
    wide ? -180 : wrapLng(minLng),
    Math.min(hi(b.maxLat), 90),
    wide ? 180 : wrapLng(maxLng),
  ].join(',')
}

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

// ── GPS → nearest country / state / region ───────────────────────────────────

function geoAutoSelect(
  lat: number,
  lng: number,
  spots: SpotWithRating[]
): { country: string; state: string; region: string } | null {
  if (!spots.length) return null
  let nearest = spots[0]
  let minDist = Infinity
  for (const s of spots) {
    const d = Math.hypot(s.lat - lat, s.lng - lng)
    if (d < minDist) { minDist = d; nearest = s }
  }
  const { country } = nearest
  for (const worldRegion of Object.values(REGION_HIERARCHY)) {
    const countryData = worldRegion[country]
    if (!countryData) continue
    for (const [state, regions] of Object.entries(countryData)) {
      for (const region of regions) {
        if (nearest.region.includes(region)) return { country, state, region }
      }
    }
  }
  return { country, state: '', region: '' }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SpotsPage() {
  const searchParams = useSearchParams()
  const initialRegion = searchParams.get('region') ?? ''
  const initialCountry = searchParams.get('country') ?? ''
  const [search, setSearch]           = useState('')
  const [difficulty, setDifficulty]   = useState('')
  const [selectedCountry, setSelectedCountry] = useState(initialCountry)
  const [selectedState, setSelectedState]     = useState('')
  const [selectedRegion, setSelectedRegion]   = useState(initialRegion)
  const [view, setView] = useState<ViewMode>(() => initialRegion ? 'list' : 'map')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [bbox, setBbox] = useState<string | null>(null)
  const handleBoundsChange = useCallback((b: MapBounds) => {
    setBbox((prev) => {
      const next = bboxParam(b)
      return prev === next ? prev : next
    })
  }, [])

  function handleGpsResult(lat: number, lng: number) {
    setUserLocation({ lat, lng })
    const match = geoAutoSelect(lat, lng, baseSpots)
    if (match) {
      setSelectedCountry(match.country)
      setSelectedState(match.state)
      setSelectedRegion(match.region)
      setSearch('')
    }
  }

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

  // The list renders in pages: 1,482 cards in one scroll meant 1,482 animated
  // canvases and an unbounded conditions request. The page is also the
  // conditions scope — see below. Page resets when the filters change, adjusted
  // during render (the React-documented pattern) rather than in an effect.
  const filterKey = `${effectiveSearch}|${difficulty}|${selectedCountry}`
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 })
  if (pageState.key !== filterKey) setPageState({ key: filterKey, page: 0 })
  const page = pageState.key === filterKey ? pageState.page : 0
  const setPage = (fn: (p: number) => number) =>
    setPageState((s) => ({ key: filterKey, page: fn(s.key === filterKey ? s.page : 0) }))

  // Live conditions — issued alongside the base list, not after it. The
  // conditions payload is a complete marker projection and never needed the
  // base list to be in flight first; gating on it made time-to-coloured-map the
  // SUM of both requests (measured 2.8 s + 4.3 s cold against production)
  // instead of the slower one.
  //
  // In map view the request is scoped to the visible area; in list view it is
  // scoped to the visible PAGE via ids= (the route caps ids at 50). An
  // unfiltered sweep is ~2,388 Open-Meteo calls against a 5,000/hour
  // allowance, which gets the whole fan-out refused and every pin rendered
  // grey — see the header on parseBbox in app/api/spots/route.ts. The list
  // view used to send the bare filtered fetch, which for a filter-less list
  // WAS that global sweep — and its 5-minute refetch made one idle tab cost
  // ~12 sweeps an hour.
  const condParams = new URLSearchParams()
  condParams.set('withConditions', 'true')
  const scoped = view === 'map' && bbox !== null
  const pageIds = view !== 'map'
    ? baseSpots.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((s) => s.id).join(',')
    : ''
  if (scoped) condParams.set('bbox', bbox)
  if (view !== 'map') condParams.set('ids', pageIds)
  const { data: conditionData } = useQuery<SpotWithRating[]>({
    queryKey: ['spots-conditions', view === 'map' ? bbox : pageIds],
    queryFn: () => fetch(`/api/spots?${condParams}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }),
    // Map view must wait for the first viewport report rather than firing an
    // unscoped global sweep in the gap before it arrives; list view waits for
    // the base list that provides the page's ids.
    enabled: view === 'map' ? bbox !== null : pageIds.length > 0,
    // A pan must not repaint the map grey while the next box loads.
    placeholderData: keepPreviousData,
    // Match the route's edge cache (s-maxage=180): refetching sooner than that
    // just re-downloads the same cached payload, and a focus refetch on a cold
    // edge re-runs the whole Open-Meteo fan-out.
    staleTime: 180 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    // A browse tab left open must keep its ratings current — nothing else in
    // the app triggers a refetch. 5 min ≈ the om:cond runtime-cache TTL (the
    // route's edge cache is shorter, s-maxage=180).
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // In map view this payload covers only the viewport, so it is merged onto the
  // base list rather than substituted for it — a substitution would delete
  // every off-screen pin. Spots outside the box keep their marker and carry no
  // rating until panned into view.
  const spots = useMemo(() => {
    // `undefined` means not loaded yet; a successful `[]` (viewport or page
    // with nothing rated) is a real answer and must not be treated as missing,
    // or keepPreviousData repaints every pin grey after an empty pan.
    if (!Array.isArray(conditionData)) return baseSpots
    const condMap = new Map(conditionData.map((s) => [s.id, s]))
    return baseSpots.map((s) => {
      const cond = condMap.get(s.id)
      return cond ? { ...s, ...cond } : s
    })
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
    <div className="flex flex-col" style={{ height: 'calc(100dvh - var(--navbar-height, 57px))' }}>
      {/* Top bar */}
      <div
        className="shrink-0 px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'white' }}
      >
        <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative w-full sm:flex-1 sm:min-w-0 sm:max-w-[220px]">
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
              <option value="expert">Expert</option>
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
                {v === 'map' ? 'Map' : 'List'}
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
            onLocate={handleGpsResult}
            onBoundsChange={handleBoundsChange}
          />

          {/* Condition summary bar */}
          {conditionsSummary && (
            <div
              className="absolute top-3 right-3 z-[1000] rounded-xl px-4 py-2.5 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
            >
              <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Live:</span>
              {conditionsSummary.epic > 0 && (
                <span className="text-xs font-bold" style={{ color: '#7c3aed' }}>{conditionsSummary.epic} Epic</span>
              )}
              {conditionsSummary.good > 0 && (
                <span className="text-xs font-bold" style={{ color: '#16a34a' }}>{conditionsSummary.good} Good</span>
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


          {isLoading && (
            <div
              className="absolute inset-0 flex items-center justify-center z-[999]"
              style={{ background: 'var(--sand-50)' }}
            >
              <WaveLoader compact label="Loading spots…" />
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
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {spots.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((spot) => (
                    <SpotCard
                      key={spot.id}
                      spot={spot}
                      rating={spot.currentRating && spot.currentRating !== 'unknown' ? spot.currentRating as ConditionRating : undefined}
                      waveHeight={spot.currentFaceHeight ?? undefined}
                      period={spot.currentPeriod ?? undefined}
                      wind={spot.currentWindSpeed ?? undefined}
                    />
                  ))}
                </div>
                {spots.length > PAGE_SIZE && (
                  <div className="mt-6 flex items-center justify-center gap-4">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
                      style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                    >
                      Previous
                    </button>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, spots.length)} of {spots.length}
                    </span>
                    <button
                      onClick={() => setPage((p) => ((p + 1) * PAGE_SIZE < spots.length ? p + 1 : p))}
                      disabled={(page + 1) * PAGE_SIZE >= spots.length}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
                      style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
