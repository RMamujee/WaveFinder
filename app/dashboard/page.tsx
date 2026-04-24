'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SpotCard } from '@/components/spots/SpotCard'
import { WaveLoader } from '@/components/layout/WaveLoader'
import { Icon } from '@/components/ui/Icon'
import type { SurfSpot } from '@/types/spot'
import type { ConditionRating } from '@/types/forecast'

interface SpotWithConditions extends SurfSpot {
  currentRating?: ConditionRating | 'unknown'
  currentWaveHeight?: number | null
  currentPeriod?: number | null
  currentWindSpeed?: number | null
}

const SAVED_KEY = 'wavefinder_saved'

function getSavedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') }
  catch { return [] }
}

export default function DashboardPage() {
  const [savedSpots, setSavedSpots] = useState<SpotWithConditions[]>([])
  const [loading, setLoading] = useState(true)

  async function loadSpots() {
    const ids = getSavedIds()
    if (!ids.length) { setSavedSpots([]); setLoading(false); return }
    try {
      const res = await fetch(`/api/spots?ids=${ids.join(',')}&withConditions=true`, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setSavedSpots(Array.isArray(data) ? data : [])
    } catch {
      setSavedSpots([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSpots()
    const handler = () => loadSpots()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--sand-50)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="mx-auto max-w-5xl px-5 py-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                My Dashboard
              </p>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
                Saved Spots
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
                {!loading && savedSpots.length > 0
                  ? `${savedSpots.length} saved spot${savedSpots.length !== 1 ? 's' : ''}`
                  : 'Save your favorite breaks to track conditions'}
              </p>
            </div>
            <Link
              href="/spots"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: 'var(--ocean-600)' }}
            >
              + Add spots
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-5 py-8">
        {loading ? (
          <WaveLoader compact label="Loading your spots…" />
        ) : savedSpots.length === 0 ? (
          <div className="rounded-2xl py-20 text-center" style={{ border: '2px dashed var(--border)', background: 'var(--surface)' }}>
            <div className="mb-4 flex justify-center" style={{ color: 'var(--text-3)' }}><Icon name="surfer" size={48} strokeWidth={1.4} /></div>
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>No saved spots yet</p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>
              Browse spots and click &quot;Save spot&quot; to track your home breaks
            </p>
            <Link href="/spots" className="inline-block rounded-xl px-6 py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--ocean-600)' }}>
              Browse spots
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedSpots.map((spot) => (
              <SpotCard
                key={spot.id}
                spot={spot}
                rating={spot.currentRating as ConditionRating | undefined}
                waveHeight={spot.currentWaveHeight ?? undefined}
                period={spot.currentPeriod ?? undefined}
                wind={spot.currentWindSpeed ?? undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
