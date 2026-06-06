'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'

export function CheckoutButton({ plan = 'monthly' }: { plan?: 'monthly' | 'annual' }) {
  const { data: session, isPending } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isPending) {
    return (
      <button disabled className="block text-center rounded-xl px-5 py-3 text-sm font-semibold text-white opacity-60" style={{ background: 'var(--ocean-600)' }}>
        Loading...
      </button>
    )
  }

  if (!session?.user) {
    return (
      <Link href="/sign-up" className="block text-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90" style={{ background: 'var(--ocean-600)' }}>
        Start 7-day trial
      </Link>
    )
  }

  async function startCheckout() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Checkout failed')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={startCheckout}
        disabled={loading}
        className="block w-full text-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ background: 'var(--ocean-600)' }}
      >
        {loading ? 'Opening checkout...' : 'Start 7-day trial'}
      </button>
      {error && <p className="mt-2 text-xs" style={{ color: '#b91c1c' }}>{error}</p>}
    </div>
  )
}
