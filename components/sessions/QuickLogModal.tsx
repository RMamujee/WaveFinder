'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from '@/lib/auth-client'

interface GuestSession {
  id: string
  spotName: string
  spotSlug?: string
  region?: string
  sessionDate: string
  duration?: number
  waveHeightFt?: number
  rating?: number
  highlights?: string
  boardType?: string
  wetsuitMm?: string
  createdAt: string
  _guest: true
}

interface SpotSuggestion {
  id: string
  name: string
  slug: string
  region: string
}

interface Props {
  open: boolean
  onClose: () => void
}

export function QuickLogModal({ open, onClose }: Props) {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user

  const [spotName, setSpotName] = useState('')
  const [spotSlug, setSpotSlug] = useState('')
  const [region, setRegion] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState('')
  const [rating, setRating] = useState(0)
  const [highlights, setHighlights] = useState('')
  const [boardType, setBoardType] = useState('')
  const [wetsuitMm, setWetsuitMm] = useState('')

  const [suggestions, setSuggestions] = useState<SpotSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setSaved(false)
      setSpotName('')
      setSpotSlug('')
      setRegion('')
      setDate(new Date().toISOString().slice(0, 10))
      setDuration('')
      setRating(0)
      setHighlights('')
      setBoardType('')
      setWetsuitMm('')
    }
  }, [open])

  // Spot autocomplete
  useEffect(() => {
    if (spotName.length < 2) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/spots?q=${encodeURIComponent(spotName)}`)
        const data = await res.json()
        if (Array.isArray(data)) setSuggestions(data.slice(0, 6))
      } catch { /* ignore */ }
    }, 280)
  }, [spotName])

  const handleSpotSelect = (s: SpotSuggestion) => {
    setSpotName(s.name)
    setSpotSlug(s.slug)
    setRegion(s.region)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleSave = async () => {
    if (!spotName || !date) return
    setSaving(true)
    try {
      if (isLoggedIn) {
        await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spotName, spotSlug: spotSlug || undefined, region: region || undefined,
            sessionDate: date, duration: duration || undefined,
            rating: rating || undefined, highlights: highlights || undefined,
            boardType: boardType || undefined, wetsuitMm: wetsuitMm || undefined,
          }),
        })
      } else {
        // Guest: save to localStorage
        const existing: GuestSession[] = JSON.parse(localStorage.getItem('wavefinder_sessions') ?? '[]')
        const entry: GuestSession = {
          id: `guest-${Date.now()}`,
          spotName, spotSlug: spotSlug || undefined, region: region || undefined,
          sessionDate: date, duration: duration ? Number(duration) : undefined,
          rating: rating || undefined, highlights: highlights || undefined,
          boardType: boardType || undefined, wetsuitMm: wetsuitMm || undefined,
          createdAt: new Date().toISOString(),
          _guest: true,
        }
        localStorage.setItem('wavefinder_sessions', JSON.stringify([entry, ...existing]))
      }
      setSaved(true)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'white', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
              Log a Session
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {isLoggedIn ? `Saving to your account` : 'Saved locally — sign up to sync across devices'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-gray-100 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {saved ? (
          <div className="px-6 py-10 text-center">
            <div className="text-4xl mb-3">🤙</div>
            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
              Session logged!
            </p>
            {!isLoggedIn && (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-3)' }}>
                <a href="/signup" style={{ color: 'var(--ocean-600)', fontWeight: 600 }}>Create a free account</a>
                {' '}to sync your sessions across devices and see your stats.
              </p>
            )}
            <div className="mt-5 flex gap-2 justify-center">
              <a
                href="/sessions"
                className="rounded-xl px-5 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--ocean-600)' }}
              >
                View all sessions
              </a>
              <button
                onClick={onClose}
                className="rounded-xl px-5 py-2 text-sm font-medium"
                style={{ background: 'var(--sand-100)', color: 'var(--text-2)' }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {/* Spot */}
            <div className="relative">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>
                Spot <span style={{ color: 'var(--coral)' }}>*</span>
              </label>
              <input
                type="text"
                value={spotName}
                onChange={(e) => { setSpotName(e.target.value); setSpotSlug(''); setRegion(''); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. Malibu, Trestles…"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden"
                  style={{ background: 'white', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                >
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSpotSelect(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-[var(--sand-50)] transition-colors"
                    >
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{s.name}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-3)' }}>{s.region}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>
                  Date <span style={{ color: 'var(--coral)' }}>*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Duration (min)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="90"
                  min={0}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Session rating</label>
              <div className="flex gap-1.5">
                {[1,2,3,4,5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(rating === n ? 0 : n)}
                    className="rounded-lg px-3 py-1.5 text-sm font-bold transition-all"
                    style={{
                      background: n <= rating ? 'var(--ocean-600)' : 'var(--sand-100)',
                      color: n <= rating ? 'white' : 'var(--text-3)',
                      border: `1.5px solid ${n <= rating ? 'var(--ocean-600)' : 'var(--border)'}`,
                    }}
                  >
                    {n}
                  </button>
                ))}
                <span className="ml-1 self-center text-xs" style={{ color: 'var(--text-3)' }}>
                  {rating === 0 ? '' : ['', 'Terrible', 'Meh', 'Decent', 'Great', 'Epic!'][rating]}
                </span>
              </div>
            </div>

            {/* Board + Wetsuit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Board</label>
                <select
                  value={boardType}
                  onChange={(e) => setBoardType(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text-2)' }}
                >
                  <option value="">— optional</option>
                  <option value="shortboard">Shortboard</option>
                  <option value="longboard">Longboard</option>
                  <option value="mid-length">Mid-length</option>
                  <option value="fish">Fish</option>
                  <option value="funboard">Funboard</option>
                  <option value="sup">SUP</option>
                  <option value="foil">Foil</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Wetsuit</label>
                <select
                  value={wetsuitMm}
                  onChange={(e) => setWetsuitMm(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text-2)' }}
                >
                  <option value="">— optional</option>
                  <option value="boardshorts">Boardshorts</option>
                  <option value="2mm">2mm</option>
                  <option value="3/2mm">3/2mm</option>
                  <option value="4/3mm">4/3mm</option>
                  <option value="5/4mm">5/4mm</option>
                  <option value="6/5mm">6/5mm</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Notes</label>
              <textarea
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
                placeholder="How was it? Waves, crowds, highlights…"
                rows={2}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none"
                style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={!spotName || !date || saving}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: 'var(--ocean-600)' }}
              >
                {saving ? 'Saving…' : 'Save session'}
              </button>
              {!isLoggedIn && (
                <a
                  href="/login"
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-center"
                  style={{ background: 'var(--sand-100)', color: 'var(--text-2)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}
                >
                  Log in
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
