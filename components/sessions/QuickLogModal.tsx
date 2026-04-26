'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from '@/components/ui/Icon'

const SESSIONS_KEY = 'wavefinder_sessions'

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

  const handleSave = () => {
    if (!spotSlug || !date) return
    setSaving(true)
    try {
      const existing = JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]')
      const entry = {
        id: `session-${Date.now()}`,
        spotName,
        spotSlug: spotSlug || null,
        region: region || null,
        sessionDate: date,
        duration: duration ? Number(duration) : null,
        waveHeightFt: null,
        wavePeriod: null,
        windSpeed: null,
        windDir: null,
        waterTempC: null,
        boardType: boardType || null,
        wetsuitMm: wetsuitMm || null,
        rating: rating || null,
        highlights: highlights || null,
        buddies: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(SESSIONS_KEY, JSON.stringify([entry, ...existing]))
      window.dispatchEvent(new Event('storage'))
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-4"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl" style={{ background: 'white', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
              Log a Session
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Saved to this device</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-gray-100 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {saved ? (
          <div className="px-6 py-10 text-center">
            <div className="flex justify-center mb-3"><Icon name="surfer" size={36} style={{ color: 'var(--ocean-600)' }} /></div>
            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
              Session logged!
            </p>
            <div className="mt-5 flex gap-2 justify-center">
              <a href="/sessions" className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: 'var(--ocean-600)' }}>
                View all sessions
              </a>
              <button onClick={onClose} className="rounded-xl px-5 py-2 text-sm font-medium" style={{ background: 'var(--sand-100)', color: 'var(--text-2)' }}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4" style={{ maxHeight: 'min(80vh, calc(100dvh - 140px))', overflowY: 'auto' }}>
            {/* Spot */}
            <div style={{ position: 'relative', zIndex: 10 }}>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>
                Spot <span style={{ color: 'var(--coral)' }}>*</span>
              </label>
              <input
                type="text"
                value={spotName}
                onChange={(e) => { setSpotName(e.target.value); setSpotSlug(''); setRegion(''); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  if (!spotSlug && spotName.trim()) { setSpotName(''); setSuggestions([]) }
                  setShowSuggestions(false)
                }}
                placeholder="Search WaveFinder spots…"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ background: 'var(--sand-50)', border: spotSlug ? '1.5px solid var(--ocean-600)' : '1.5px solid var(--border)', color: 'var(--text)' }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: '4px', borderRadius: '12px', overflow: 'hidden', background: 'white', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                  {suggestions.map((s) => (
                    <button key={s.id} onMouseDown={(e) => { e.preventDefault(); handleSpotSelect(s) }} className="w-full text-left px-4 py-2.5 hover:bg-[var(--sand-50)] transition-colors">
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
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Date <span style={{ color: 'var(--coral)' }}>*</span></label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Duration (min)</label>
                <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="90" min={0} className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text)' }} />
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Session rating</label>
              <div className="flex gap-1.5">
                {[1,2,3,4,5].map((n) => (
                  <button key={n} onClick={() => setRating(rating === n ? 0 : n)} className="rounded-lg px-3 py-1.5 text-sm font-bold transition-all"
                    style={{ background: n <= rating ? 'var(--ocean-600)' : 'var(--sand-100)', color: n <= rating ? 'white' : 'var(--text-3)', border: `1.5px solid ${n <= rating ? 'var(--ocean-600)' : 'var(--border)'}` }}>
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
                <select value={boardType} onChange={(e) => setBoardType(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text-2)' }}>
                  <option value="">— optional</option>
                  {['Shortboard','Longboard','Mid-length','Fish','Funboard','SUP','Foil'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Wetsuit</label>
                <select value={wetsuitMm} onChange={(e) => setWetsuitMm(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none" style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text-2)' }}>
                  <option value="">— optional</option>
                  {['Boardshorts','2mm','3/2mm','4/3mm','5/4mm','6/5mm'].map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Notes</label>
              <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder="How was it? Waves, crowds, highlights…" rows={2} className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none" style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text)' }} />
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={!spotSlug || !date || saving}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: 'var(--ocean-600)' }}
            >
              {saving ? 'Saving…' : 'Save session'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
