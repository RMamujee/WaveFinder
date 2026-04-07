import Link from 'next/link'
import type { SurfSpot } from '@/types/spot'
import type { ConditionRating } from '@/types/forecast'

interface Props {
  spot: SurfSpot
  rating?: ConditionRating
  waveHeight?: number
}

const DIFFICULTY_STYLES = {
  beginner:     { color: '#15803d', bg: '#f0fdf4' },
  intermediate: { color: '#b45309', bg: '#fffbeb' },
  advanced:     { color: '#b91c1c', bg: '#fef2f2' },
}

const RATING_DOTS: Record<ConditionRating, string> = {
  poor: '#9ca3af', fair: '#f59e0b', good: '#16a34a', epic: '#7c3aed',
}

export function SpotCard({ spot, rating, waveHeight }: Props) {
  const diffStyle = DIFFICULTY_STYLES[spot.difficulty as keyof typeof DIFFICULTY_STYLES]

  return (
    <Link
      href={`/spots/${spot.slug}`}
      className="group block rounded-xl p-4 transition-all"
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            className="font-semibold truncate transition-colors group-hover:text-[var(--ocean-600)]"
            style={{ fontSize: '14px', color: 'var(--text)' }}
          >
            {spot.name}
          </h3>
          <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{spot.region}</p>
        </div>
        {rating && (
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0 mt-1"
            style={{ background: RATING_DOTS[rating] }}
            title={rating}
          />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
          style={{ background: diffStyle.bg, color: diffStyle.color }}
        >
          {spot.difficulty}
        </span>
        {waveHeight !== undefined && (
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {Math.round(waveHeight * 3.281)}ft
          </span>
        )}
      </div>
    </Link>
  )
}
