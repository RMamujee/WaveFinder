'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SpotCard } from '@/components/spots/SpotCard'
import { Icon } from '@/components/ui/Icon'
import { WaveLoader } from '@/components/layout/WaveLoader'
import { migrateSavedSpots } from '@/lib/spots/saved-spots-migration'
import type { SurfSpot } from '@/types/spot'

const SAVED_KEY = 'wavefinder_saved'

function getSavedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') }
  catch { return [] }
}

export default function DashboardPage() {
  const [savedSpots, setSavedSpots] = useState<SurfSpot[]>([])
  const [loading, setLoading] = useState(true)

  async function loadSpots() {
    // One-time migration of legacy cuid saved-spot ids to slugs. Idempotent and
    // failure-safe: once everything is a slug it's a no-op. It dispatches a
    // 'storage' event only when it rewrites the list, which re-runs loadSpots
    // with the migrated slugs.
    await migrateSavedSpots()
    const ids = getSavedIds()
    if (!ids.length) { setSavedSpots([]); setLoading(false); return }
    try {
      const res = await fetch(`/api/spots?ids=${ids.join(',')}`, { signal: AbortSignal.timeout(10000) })
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
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="mx-auto max-w-5xl px-5 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                My Dashboard
              </p>
              <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
                Saved Spots
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
                {!loading && savedSpots.length > 0
                  ? `${savedSpots.length} saved spot${savedSpots.length !== 1 ? 's' : ''}`
                  : 'Save your favorite breaks to track conditions'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-5 py-8">
        {loading ? (
          <WaveLoader compact label="Loading your spots…" />
        ) : savedSpots.length === 0 ? (
          <div className="rounded-2xl py-20 text-center" style={{ border: '2px dashed var(--border)', background: 'white' }}>
            <div className="flex justify-center mb-4"><Icon name="surfer" size={40} style={{ color: 'var(--text-3)' }} /></div>
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
            {savedSpots.map((spot) => <SpotCard key={spot.id} spot={spot} />)}
          </div>
        )}
      </div>
    </div>
  )
}
