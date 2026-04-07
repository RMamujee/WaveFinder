'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { SpotCard } from '@/components/spots/SpotCard'
import type { SurfSpot } from '@/types/spot'
import type { ConditionRating } from '@/types/forecast'

interface SpotWithRating extends SurfSpot {
  currentRating?: ConditionRating | 'unknown'
  currentWaveHeight?: number | null
  currentPeriod?: number | null
  currentWindSpeed?: number | null
  wavePower?: number | null
}

const SpotMap = dynamic(
  () => import('@/components/spots/SpotMap').then((m) => m.SpotMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse" style={{ background: 'var(--sand-100)' }} /> }
)

const QUICK_FILTERS = [
  { label: 'All CA', q: '' },
  { label: 'San Diego', q: 'San Diego' },
  { label: 'OC', q: 'Orange County' },
  { label: 'Los Angeles', q: 'Los Angeles' },
  { label: 'Ventura', q: 'Ventura' },
  { label: 'Santa Barbara', q: 'Santa Barbara' },
  { label: 'Central Coast', q: 'Central Coast' },
  { label: 'Monterey Bay', q: 'Monterey' },
  { label: 'NorCal', q: 'NorCal' },
]

type ViewMode = 'map' | 'list'

export default function SpotsPage() {
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [quickSearch, setQuickSearch] = useState('')
  const [view, setView] = useState<ViewMode>('map')

  const effectiveSearch = search || quickSearch

  const baseParams = new URLSearchParams()
  if (effectiveSearch) baseParams.set('q', effectiveSearch)
  if (difficulty) baseParams.set('difficulty', difficulty)

  // Stage 1: load spots from DB instantly (no external API calls)
  const { data: baseSpots = [], isLoading } = useQuery<SpotWithRating[]>({
    queryKey: ['spots', effectiveSearch, difficulty],
    queryFn: () => fetch(`/api/spots?${baseParams}`).then((r) => r.json()),
    staleTime: 30 * 60 * 1000,
  })

  // Stage 2: enrich with live conditions in background (separate slower request)
  const condParams = new URLSearchParams(baseParams)
  condParams.set('withConditions', 'true')
  const { data: conditionData } = useQuery<SpotWithRating[]>({
    queryKey: ['spots-conditions', effectiveSearch, difficulty],
    queryFn: () => fetch(`/api/spots?${condParams}`).then((r) => r.json()),
    staleTime: 15 * 60 * 1000,
    enabled: baseSpots.length > 0,
  })

  // Merge: use base spots immediately, overlay conditions when available
  const spots = useMemo(() => {
    if (!conditionData) return baseSpots
    const condMap = new Map(conditionData.map((s) => [s.id, s]))
    return baseSpots.map((s) => ({ ...s, ...condMap.get(s.id) }))
  }, [baseSpots, conditionData])

  // Center map on filtered region
  const mapCenter = useMemo(() => {
    if (quickSearch.includes('San Diego'))     return { lat: 32.85, lng: -117.27, zoom: 11 }
    if (quickSearch.includes('Orange County')) return { lat: 33.55, lng: -117.75, zoom: 11 }
    if (quickSearch.includes('Los Angeles'))   return { lat: 33.95, lng: -118.42, zoom: 11 }
    if (quickSearch.includes('Ventura'))       return { lat: 34.25, lng: -119.25, zoom: 10 }
    if (quickSearch.includes('Santa Barbara')) return { lat: 34.42, lng: -119.70, zoom: 11 }
    if (quickSearch.includes('Central Coast')) return { lat: 35.30, lng: -120.80, zoom: 10 }
    if (quickSearch.includes('Monterey'))      return { lat: 36.85, lng: -121.95, zoom: 10 }
    if (quickSearch.includes('NorCal'))        return { lat: 38.50, lng: -123.00, zoom: 8  }
    return { lat: 36.5, lng: -120.5, zoom: 7 } // Full California view
  }, [quickSearch])

  const conditionsSummary = useMemo(() => {
    if (!spots.length) return null
    const withData = spots.filter(s => s.currentRating && s.currentRating !== 'unknown')
    if (!withData.length) return null
    const counts = { epic: 0, good: 0, fair: 0, poor: 0 }
    withData.forEach(s => { counts[s.currentRating as keyof typeof counts] = (counts[s.currentRating as keyof typeof counts] ?? 0) + 1 })
    return counts
  }, [spots])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 57px)' }}>
      {/* Top bar */}
      <div
        className="shrink-0 px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'white' }}
      >
        <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
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
              onChange={(e) => { setSearch(e.target.value); setQuickSearch('') }}
              className="w-full rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none"
              style={{
                background: 'var(--sand-100)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          {/* Quick filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => { setQuickSearch(f.q); setSearch('') }}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: quickSearch === f.q && !search
                    ? 'var(--ocean-600)' : 'var(--sand-100)',
                  color: quickSearch === f.q && !search
                    ? 'white' : 'var(--text-2)',
                  border: `1px solid ${quickSearch === f.q && !search ? 'var(--ocean-600)' : 'var(--border)'}`,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Difficulty */}
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs font-medium focus:outline-none"
            style={{
              background: 'var(--sand-100)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
            }}
          >
            <option value="">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          {/* View toggle */}
          <div
            className="flex rounded-lg overflow-hidden ml-auto"
            style={{ border: '1px solid var(--border)' }}
          >
            {(['map', 'list'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium transition-colors capitalize"
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
        /* Map view — full height */
        <div className="flex-1 relative overflow-hidden">
          <SpotMap
            spots={spots}
            centerLat={mapCenter.lat}
            centerLng={mapCenter.lng}
            zoom={mapCenter.zoom}
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl" style={{ background: 'var(--sand-100)' }} />
                ))}
              </div>
            ) : spots.length === 0 ? (
              <div className="py-20 text-center" style={{ color: 'var(--text-3)' }}>
                No spots match your filters.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {spots.map((spot) => <SpotCard key={spot.id} spot={spot} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
