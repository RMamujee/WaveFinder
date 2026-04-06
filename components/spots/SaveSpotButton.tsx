'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'

export function SaveSpotButton({ spotId }: { spotId: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: savedSpots = [] } = useQuery<{ id: string }[]>({
    queryKey: ['saved-spots'],
    queryFn: () =>
      session?.user ? fetch('/api/saved-spots').then((r) => r.json()) : Promise.resolve([]),
    enabled: !!session?.user,
  })

  const isSaved = savedSpots.some((s) => s.id === spotId)

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch('/api/saved-spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-spots'] }),
  })

  const unsaveMutation = useMutation({
    mutationFn: () => fetch(`/api/saved-spots/${spotId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-spots'] }),
  })

  const handleClick = () => {
    if (!session?.user) { router.push('/login'); return }
    isSaved ? unsaveMutation.mutate() : saveMutation.mutate()
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all"
      style={{
        background: isSaved ? '#fef2f2' : 'white',
        border: `1.5px solid ${isSaved ? '#fca5a5' : 'var(--border)'}`,
        color: isSaved ? '#b91c1c' : 'var(--text-2)',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24"
        fill={isSaved ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="2"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {isSaved ? 'Saved' : 'Save spot'}
    </button>
  )
}
