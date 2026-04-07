'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { SpotCard } from '@/components/spots/SpotCard'
import { WaveLoader } from '@/components/layout/WaveLoader'
import type { SurfSpot } from '@/types/spot'

export default function DashboardPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isPending && !session?.user) router.push('/login')
  }, [session, isPending, router])

  const { data: savedSpots = [], isLoading } = useQuery<SurfSpot[]>({
    queryKey: ['saved-spots'],
    queryFn: () => fetch('/api/saved-spots').then((r) => r.json()),
    enabled: !!session?.user,
  })

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center" style={{ background: 'var(--sand-50)' }}>
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--ocean-500)] border-t-transparent" />
      </div>
    )
  }

  if (!session?.user) return null

  return (
    <div className="min-h-screen" style={{ background: 'var(--sand-50)' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="mx-auto max-w-5xl px-5 py-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>
                My Dashboard
              </p>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
                Hey, {session.user.name?.split(' ')[0]} 👋
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
                {savedSpots.length > 0
                  ? `You have ${savedSpots.length} saved spot${savedSpots.length !== 1 ? 's' : ''}`
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
        {isLoading ? (
          <WaveLoader compact label="Loading your spots…" />
        ) : savedSpots.length === 0 ? (
          <div
            className="rounded-2xl py-20 text-center"
            style={{ border: '2px dashed var(--border)', background: 'white' }}
          >
            <div className="text-4xl mb-4">🏄</div>
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>No saved spots yet</p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>
              Browse spots and click "Save spot" to track your home breaks
            </p>
            <Link
              href="/spots"
              className="inline-block rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--ocean-600)' }}
            >
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
