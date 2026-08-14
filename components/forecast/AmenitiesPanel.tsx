'use client'

import { useQuery } from '@tanstack/react-query'
import { Icon } from '@/components/ui/Icon'
import type { Amenity } from '@/lib/api/overpass'

interface Props { spotSlug: string }

function formatDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
}

// Group amenities by type for a cleaner layout
const TYPE_ORDER = [
  'toilets', 'shower', 'drinking_water', 'parking',
  'cafe', 'restaurant', 'fast_food', 'ice_cream',
  'bicycle_rental', 'surf_school', 'first_aid', 'lifeguard',
]

export function AmenitiesPanel({ spotSlug }: Props) {
  const { data, isLoading } = useQuery<{ amenities: Amenity[] }>({
    queryKey: ['amenities', spotSlug],
    queryFn: () => fetch(`/api/amenities/${spotSlug}`).then((r) => r.json()),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })

  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-5 animate-pulse"
        style={{ background: 'white', border: '1px solid var(--border)', minHeight: 80 }}
      />
    )
  }
  if (!data?.amenities?.length) return null

  // Sort by TYPE_ORDER preference then by distance
  const sorted = [...data.amenities].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a.amenityType)
    const bi = TYPE_ORDER.indexOf(b.amenityType)
    const aOrder = ai === -1 ? 99 : ai
    const bOrder = bi === -1 ? 99 : bi
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.distanceM - b.distanceM
  })

  return (
    <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon name="pin" size={18} strokeWidth={1.5} style={{ color: 'var(--ocean-500)' }} />
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          Nearby Facilities
        </span>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>within 1 km</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sorted.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-2.5 rounded-xl p-3"
            style={{ background: 'var(--sand-50)', border: '1px solid var(--border)' }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{a.emoji}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--text)' }}>
                {a.name ?? a.label}
              </p>
              {a.name && (
                <p className="text-xs leading-tight mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {a.label}
                </p>
              )}
              <p className="text-xs mt-1 font-medium" style={{ color: 'var(--ocean-600)' }}>
                {formatDist(a.distanceM)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>
        Source: OpenStreetMap contributors · Data may be incomplete
      </p>
    </div>
  )
}
