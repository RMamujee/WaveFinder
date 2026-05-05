'use client'

import { useState } from 'react'

export function PortalButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openPortal() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Billing portal unavailable')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Billing portal unavailable')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={openPortal}
        disabled={loading}
        className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
        style={{ background: 'var(--sand-100)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        {loading ? 'Opening...' : 'Manage billing'}
      </button>
      {error && <p className="mt-2 text-xs" style={{ color: '#b91c1c' }}>{error}</p>}
    </div>
  )
}
