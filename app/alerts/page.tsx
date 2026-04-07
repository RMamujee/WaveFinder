'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface SpotAlert {
  id: string
  spotId: string
  spotName: string
  minRating: 'good' | 'epic'
  email: string
  active: boolean
  lastSentAt: string | null
  createdAt: string
}

interface SurfSpot {
  id: string
  slug: string
  name: string
  region: string
}

export default function AlertsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const qc = useQueryClient()

  const [spotQuery, setSpotQuery] = useState('')
  const [selectedSpot, setSelectedSpot] = useState<SurfSpot | null>(null)
  const [minRating, setMinRating] = useState<'good' | 'epic'>('good')
  const [email, setEmail] = useState('')
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (session?.user?.email) setEmail(session.user.email)
  }, [session?.user?.email])

  const { data: alerts = [], isLoading } = useQuery<SpotAlert[]>({
    queryKey: ['alerts'],
    queryFn: () => fetch('/api/alerts').then((r) => r.json()),
    enabled: !!session?.user,
  })

  const { data: spots = [] } = useQuery<SurfSpot[]>({
    queryKey: ['spots-search', spotQuery],
    queryFn: () => fetch(`/api/spots?q=${encodeURIComponent(spotQuery)}`).then((r) => r.json()),
    enabled: spotQuery.length > 1,
    staleTime: 60000,
  })

  const createMutation = useMutation({
    mutationFn: (data: { spotId: string; spotName: string; minRating: string; email: string }) =>
      fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      setSelectedSpot(null)
      setSpotQuery('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/alerts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      fetch(`/api/alerts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  if (!session?.user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sand-50)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
          <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>Sign in to manage surf alerts</p>
          <a href="/login" style={{ background: 'var(--ocean-600)', color: 'white', borderRadius: 10, padding: '10px 20px', textDecoration: 'none', fontWeight: 600 }}>Sign in</a>
        </div>
      </div>
    )
  }

  function handleAddAlert() {
    if (!selectedSpot || !email) return
    createMutation.mutate({ spotId: selectedSpot.id, spotName: selectedSpot.name, minRating, email })
  }

  return (
    <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px 28px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ocean-500)', marginBottom: 8 }}>Notifications</p>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Surf Alerts</h1>
          <p style={{ color: 'var(--text-2)', marginTop: 8, fontSize: 14 }}>Get an email the morning conditions hit Good or Epic at your spots.</p>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px' }}>

        {/* Add alert card */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border)', padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
            Add New Alert
          </h2>

          {/* Spot search */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spot</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder={selectedSpot ? selectedSpot.name : 'Search for a spot…'}
                value={selectedSpot ? selectedSpot.name : spotQuery}
                onChange={(e) => { setSpotQuery(e.target.value); setSelectedSpot(null); setOpen(true) }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--sand-50)', fontSize: 14, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
              />
              {selectedSpot && (
                <button onClick={() => { setSelectedSpot(null); setSpotQuery('') }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>×</button>
              )}
              {open && spots.length > 0 && !selectedSpot && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                  {spots.slice(0, 8).map((s) => (
                    <button
                      key={s.id}
                      onMouseDown={() => { setSelectedSpot(s); setSpotQuery(''); setOpen(false) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{s.name}</span>
                      <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 8 }}>{s.region}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Threshold */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alert me when conditions are</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['good', 'epic'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setMinRating(r)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                    background: minRating === r ? (r === 'epic' ? '#f5f3ff' : '#f0fdf4') : 'var(--sand-50)',
                    color: minRating === r ? (r === 'epic' ? '#7c3aed' : '#15803d') : 'var(--text-2)',
                    border: `1.5px solid ${minRating === r ? (r === 'epic' ? '#ddd6fe' : '#bbf7d0') : 'var(--border)'}`,
                  }}
                >
                  {r === 'good' ? '✅ Good or better' : '🏆 Epic only'}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Send to</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--sand-50)', fontSize: 14, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={handleAddAlert}
            disabled={!selectedSpot || !email || createMutation.isPending}
            style={{
              width: '100%', padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: !selectedSpot || !email ? 'not-allowed' : 'pointer', border: 'none',
              background: !selectedSpot || !email ? 'var(--sand-200)' : 'var(--ocean-600)',
              color: !selectedSpot || !email ? 'var(--text-3)' : 'white',
              transition: 'background 0.15s',
            }}
          >
            {createMutation.isPending ? 'Saving…' : '🔔 Create Alert'}
          </button>
          {saved && <p style={{ color: '#15803d', fontSize: 13, textAlign: 'center', marginTop: 10 }}>✓ Alert saved! You'll get emails at 7am when conditions match.</p>}
        </div>

        {/* Active alerts */}
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
          Active Alerts {alerts.length > 0 && <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-3)' }}>({alerts.length})</span>}
        </h2>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</div>
        ) : alerts.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 16, border: '2px dashed var(--border)', padding: '40px 24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            No alerts yet. Add one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {alerts.map((a) => (
              <div key={a.id} style={{ background: 'white', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, opacity: a.active ? 1 : 0.6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.spotName}</p>
                  <p style={{ color: 'var(--text-3)', fontSize: 12, margin: '3px 0 0' }}>
                    {a.minRating === 'epic' ? '🏆 Epic only' : '✅ Good or better'} · {a.email}
                  </p>
                  {a.lastSentAt && (
                    <p style={{ color: 'var(--text-3)', fontSize: 11, margin: '2px 0 0' }}>
                      Last sent: {new Date(a.lastSentAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {/* Toggle */}
                <button
                  onClick={() => toggleMutation.mutate({ id: a.id, active: !a.active })}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    background: a.active ? 'var(--ocean-500)' : 'var(--sand-200)',
                  }}
                  title={a.active ? 'Pause alert' : 'Enable alert'}
                >
                  <span style={{
                    position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', left: a.active ? 23 : 3,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }} />
                </button>
                {/* Delete */}
                <button
                  onClick={() => deleteMutation.mutate(a.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0, padding: '0 4px' }}
                  title="Delete alert"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
