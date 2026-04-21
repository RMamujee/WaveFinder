'use client'

import { useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { format, parseISO } from 'date-fns'
import { getBoards, getWetsuits, BOARD_TYPES, WETSUIT_OPTIONS } from '@/lib/gear'

// ─── localStorage helpers ─────────────────────────────────────────────────────

const SESSIONS_KEY = 'wavefinder_sessions'

function getSessions(): SurfSession[] {
  try {
    const raw: Record<string, unknown>[] = JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]')
    return raw.map((s) => ({
      id: String(s.id ?? `session-${Date.now()}`),
      spotName: String(s.spotName ?? ''),
      spotSlug: (s.spotSlug ?? null) as string | null,
      region: (s.region ?? null) as string | null,
      sessionDate: String(s.sessionDate ?? ''),
      duration: (s.duration ?? null) as number | null,
      waveHeightFt: (s.waveHeightFt ?? null) as number | null,
      wavePeriod: (s.wavePeriod ?? null) as number | null,
      windSpeed: (s.windSpeed ?? null) as number | null,
      windDir: (s.windDir ?? null) as string | null,
      waterTempC: (s.waterTempC ?? null) as number | null,
      boardType: (s.boardType ?? null) as string | null,
      wetsuitMm: (s.wetsuitMm ?? null) as string | null,
      rating: (s.rating ?? null) as number | null,
      highlights: (s.highlights ?? null) as string | null,
      buddies: (s.buddies ?? null) as string | null,
      createdAt: String(s.createdAt ?? new Date().toISOString()),
      updatedAt: String(s.updatedAt ?? s.createdAt ?? new Date().toISOString()),
    }))
  } catch { return [] }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SurfSession {
  id: string
  spotName: string
  spotSlug: string | null
  region: string | null
  sessionDate: string
  duration: number | null
  waveHeightFt: number | null
  wavePeriod: number | null
  windSpeed: number | null
  windDir: string | null
  waterTempC: number | null
  boardType: string | null
  wetsuitMm: string | null
  rating: number | null
  highlights: string | null
  buddies: string | null
  createdAt: string
  updatedAt: string
}

interface FormState {
  spotName: string
  region: string
  sessionDate: string
  sessionTime: string
  duration: string
  waveHeightFt: string
  wavePeriod: string
  windSpeed: string
  windDir: string
  waterTempC: string
  boardType: string
  wetsuitMm: string
  rating: number
  buddies: string
  highlights: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function WaveRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span style={{ letterSpacing: '1px', fontSize: '14px' }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ opacity: i < value ? 1 : 0.2 }}>
          🌊
        </span>
      ))}
    </span>
  )
}

// ─── Log Session Modal ────────────────────────────────────────────────────────

const WIND_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const EMPTY_FORM: FormState = {
  spotName: '',
  region: '',
  sessionDate: todayISO(),
  sessionTime: '',
  duration: '',
  waveHeightFt: '',
  wavePeriod: '',
  windSpeed: '',
  windDir: '',
  waterTempC: '',
  boardType: '',
  wetsuitMm: '',
  rating: 0,
  buddies: '',
  highlights: '',
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: '100%',
    background: 'var(--sand-50)',
    border: '1.5px solid var(--border)',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '14px',
    color: 'var(--text)',
    outline: 'none',
    ...extra,
  }
}

function labelStyle(): React.CSSProperties {
  return {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-3)',
    marginBottom: '5px',
  }
}

function sectionHeadingStyle(): React.CSSProperties {
  return {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--ocean-600)',
    marginBottom: '12px',
    paddingBottom: '6px',
    borderBottom: '1px solid var(--border)',
  }
}

interface SpotSuggestion { id: string; name: string; slug: string; region: string }

interface LogSessionModalProps {
  onClose: () => void
  onSuccess: () => void
  initialData?: Partial<FormState>
  initialSlug?: string
}

function LogSessionModal({ onClose, onSuccess, initialData, initialSlug }: LogSessionModalProps) {
  const now = new Date()
  const defaultTime = `${String(now.getHours()).padStart(2, '0')}:00`
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, sessionTime: defaultTime, ...initialData })
  const [submitError, setSubmitError] = useState('')
  const [lockerBoards] = useState(() => getBoards())
  const [lockerWetsuits] = useState(() => getWetsuits())

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<SpotSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null)
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const comboboxRef = useRef<HTMLDivElement>(null)

  // Auto-fill state
  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set())

  const set = (field: keyof FormState, value: string | number) => {
    setAutoFilledFields((prev) => { const n = new Set(prev); n.delete(field as string); return n })
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced spot search
  const handleSpotInput = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, spotName: value }))
    setSelectedSlug(null)
    setAutoFilledFields(new Set())

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/spots?q=${encodeURIComponent(value.trim())}`)
        if (!res.ok) throw new Error(`${res.status}`)
        const spots: SpotSuggestion[] = await res.json()
        setSuggestions(spots.slice(0, 8))
        setShowSuggestions(spots.length > 0)
      } catch {
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setIsSearching(false)
      }
    }, 280)
  }, [])

  // Pick a spot from dropdown
  const selectSuggestion = (spot: SpotSuggestion) => {
    setForm((prev) => ({ ...prev, spotName: spot.name, region: spot.region }))
    setSelectedSlug(spot.slug)
    setSuggestions([])
    setShowSuggestions(false)
  }

  // Auto-fill conditions from forecast — triggered manually by button
  const handleAutoFill = async () => {
    if (!selectedSlug || !form.sessionDate) return

    const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    if (form.sessionDate > sevenDaysOut) return  // outside forecast window

    setAutoFilling(true)
    try {
      const res = await fetch(`/api/forecast/${selectedSlug}`)
      const data: { forecast?: Array<{ date: string; hours: Array<{ time: string; waveHeight: number; swellPeriod: number; wind: { speed: number; directionLabel: string }; waterTemp: number | null }> }> } = await res.json()

      const targetDay = data.forecast?.find((d) => d.date === form.sessionDate)
      if (!targetDay?.hours.length) return

      // Use sessionTime to find the closest forecast hour
      const targetHour = form.sessionTime
        ? parseInt(form.sessionTime.split(':')[0], 10)
        : 12

      const hour = targetDay.hours.reduce((best, h) => {
        const hHour = parseInt(h.time.split('T')[1]?.split(':')[0] ?? '12', 10)
        const bestHour = parseInt(best.time.split('T')[1]?.split(':')[0] ?? '12', 10)
        return Math.abs(hHour - targetHour) < Math.abs(bestHour - targetHour) ? h : best
      })

      const waveHeightFt = String(Math.round(hour.waveHeight * 3.281 * 2) / 2)
      const wavePeriod = String(Math.round(hour.swellPeriod))
      const windSpeed = String(Math.round(hour.wind.speed))
      const windDir = hour.wind.directionLabel
      const waterTempC = hour.waterTemp !== null ? String(Math.round(hour.waterTemp * 2) / 2) : ''

      setForm((prev) => ({ ...prev, waveHeightFt, wavePeriod, windSpeed, windDir, waterTempC }))

      const filled = new Set(['waveHeightFt', 'wavePeriod', 'windSpeed', 'windDir'])
      if (waterTempC) filled.add('waterTempC')
      setAutoFilledFields(filled)
    } catch {/* silently fail — user can enter manually */}
    finally { setAutoFilling(false) }
  }

  const mutation = useMutation({
    mutationFn: async (data: FormState) => {
      const stored = getSessions()
      const entry: SurfSession = {
        id: `session-${Date.now()}`,
        spotName: data.spotName,
        spotSlug: selectedSlug ?? null,
        region: data.region || null,
        sessionDate: data.sessionDate,
        duration: data.duration ? parseInt(data.duration) : null,
        waveHeightFt: data.waveHeightFt ? parseFloat(data.waveHeightFt) : null,
        wavePeriod: data.wavePeriod ? parseInt(data.wavePeriod) : null,
        windSpeed: data.windSpeed ? parseFloat(data.windSpeed) : null,
        windDir: data.windDir || null,
        waterTempC: data.waterTempC ? parseFloat(data.waterTempC) : null,
        boardType: data.boardType || null,
        wetsuitMm: data.wetsuitMm || null,
        rating: data.rating || null,
        highlights: data.highlights || null,
        buddies: data.buddies || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(SESSIONS_KEY, JSON.stringify([entry, ...stored]))
      window.dispatchEvent(new Event('storage'))
      return entry
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (err: Error) => {
      setSubmitError(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    if (!selectedSlug) {
      setSubmitError('Please select a spot from the dropdown — only spots on the site can be logged.')
      return
    }
    mutation.mutate(form)
  }

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Pill badge shown on auto-filled labels
  const AutoBadge = () => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      background: '#eff6ff', color: '#1d4ed8',
      fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em',
      borderRadius: '4px', padding: '1px 5px', marginLeft: '6px',
      verticalAlign: 'middle',
    }}>
      ⚡ AUTO
    </span>
  )

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,20,40,0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            background: 'white',
            borderRadius: '20px 20px 0 0',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ocean-600)', marginBottom: '3px' }}>
                Surf Log Entry
              </p>
              <h2
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Log a Session
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'var(--sand-100)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                color: 'var(--text-3)',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Section 1: Location & Date */}
          <div>
            <p style={sectionHeadingStyle()}>① Location &amp; Date</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* Spot autocomplete */}
              <div className="col-span-full" ref={comboboxRef}>
                <label style={labelStyle()}>Spot name *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={form.spotName}
                    onChange={(e) => handleSpotInput(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => {
                      // If the user typed something but didn't pick from the list, clear it
                      setTimeout(() => {
                        if (!selectedSlug && form.spotName.trim()) {
                          setForm((prev) => ({ ...prev, spotName: '', region: '' }))
                          setSuggestions([])
                        }
                        setShowSuggestions(false)
                      }, 200)
                    }}
                    placeholder="Search for a spot… e.g. Santa Monica"
                    autoComplete="off"
                    style={{
                      ...inputStyle(),
                      paddingRight: isSearching ? '36px' : '12px',
                      border: selectedSlug ? '1.5px solid var(--ocean-600)' : '1.5px solid var(--border)',
                    }}
                  />
                  {/* Search spinner */}
                  {isSearching && (
                    <div style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      width: '14px', height: '14px',
                      border: '2px solid var(--sand-200)',
                      borderTopColor: 'var(--ocean-600)',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                  )}
                  {/* Checkmark when confirmed */}
                  {selectedSlug && !isSearching && (
                    <div style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--ocean-600)', fontSize: '14px', fontWeight: 700,
                    }}>✓</div>
                  )}

                  {/* Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                      background: 'white',
                      border: '1.5px solid var(--border)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      zIndex: 100,
                      overflow: 'hidden',
                    }}>
                      {suggestions.map((spot, i) => (
                        <button
                          key={spot.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectSuggestion(spot) }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderTop: i > 0 ? '1px solid var(--sand-100)' : 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sand-50)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                            {spot.name}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '1px' }}>
                            {spot.region}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!selectedSlug && (
                  <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                    Only spots listed on WaveFinder can be selected
                  </p>
                )}
                {selectedSlug && (
                  <p style={{ fontSize: '11px', color: 'var(--ocean-600)', marginTop: '4px' }}>
                    ✓ {form.region} — set date &amp; time, then auto-fill conditions below
                  </p>
                )}
              </div>

              <div>
                <label style={labelStyle()}>Date</label>
                <input
                  type="date"
                  value={form.sessionDate}
                  onChange={(e) => set('sessionDate', e.target.value)}
                  required
                  style={inputStyle()}
                />
              </div>
              <div>
                <label style={labelStyle()}>Time of session</label>
                <input
                  type="time"
                  value={form.sessionTime}
                  onChange={(e) => set('sessionTime', e.target.value)}
                  style={inputStyle()}
                />
              </div>
              <div>
                <label style={labelStyle()}>
                  Duration in water
                  {form.duration ? ` — ${formatDuration(parseInt(form.duration))}` : ''}
                </label>
                <input
                  type="number"
                  value={form.duration}
                  onChange={(e) => set('duration', e.target.value)}
                  placeholder="minutes (e.g. 120)"
                  min={1}
                  style={inputStyle()}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Conditions */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ ...sectionHeadingStyle(), margin: 0, flex: 1 }}>② Conditions</p>
              {autoFilling ? (
                <span style={{ fontSize: '11px', color: 'var(--ocean-600)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{
                    display: 'inline-block', width: '10px', height: '10px',
                    border: '2px solid #bfdbfe', borderTopColor: 'var(--ocean-600)',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                  }} />
                  Fetching conditions…
                </span>
              ) : selectedSlug ? (
                <button
                  type="button"
                  onClick={handleAutoFill}
                  style={{
                    background: 'var(--ocean-600)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  ⚡ Auto-fill from forecast
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label style={labelStyle()}>
                  Wave height (ft)
                  {autoFilledFields.has('waveHeightFt') && <AutoBadge />}
                </label>
                <input
                  type="number"
                  value={form.waveHeightFt}
                  onChange={(e) => set('waveHeightFt', e.target.value)}
                  placeholder="e.g. 6"
                  min={0}
                  step={0.5}
                  style={{
                    ...inputStyle(),
                    borderColor: autoFilledFields.has('waveHeightFt') ? '#93c5fd' : undefined,
                    background: autoFilledFields.has('waveHeightFt') ? '#eff6ff' : undefined,
                  }}
                />
              </div>
              <div>
                <label style={labelStyle()}>
                  Wave period (s)
                  {autoFilledFields.has('wavePeriod') && <AutoBadge />}
                </label>
                <input
                  type="number"
                  value={form.wavePeriod}
                  onChange={(e) => set('wavePeriod', e.target.value)}
                  placeholder="e.g. 14"
                  min={1}
                  style={{
                    ...inputStyle(),
                    borderColor: autoFilledFields.has('wavePeriod') ? '#93c5fd' : undefined,
                    background: autoFilledFields.has('wavePeriod') ? '#eff6ff' : undefined,
                  }}
                />
              </div>
              <div>
                <label style={labelStyle()}>
                  Wind speed (km/h)
                  {autoFilledFields.has('windSpeed') && <AutoBadge />}
                </label>
                <input
                  type="number"
                  value={form.windSpeed}
                  onChange={(e) => set('windSpeed', e.target.value)}
                  placeholder="e.g. 15"
                  min={0}
                  style={{
                    ...inputStyle(),
                    borderColor: autoFilledFields.has('windSpeed') ? '#93c5fd' : undefined,
                    background: autoFilledFields.has('windSpeed') ? '#eff6ff' : undefined,
                  }}
                />
              </div>
              <div>
                <label style={labelStyle()}>
                  Wind direction
                  {autoFilledFields.has('windDir') && <AutoBadge />}
                </label>
                <select
                  value={form.windDir}
                  onChange={(e) => set('windDir', e.target.value)}
                  style={{
                    ...inputStyle({ appearance: 'auto' }),
                    borderColor: autoFilledFields.has('windDir') ? '#93c5fd' : undefined,
                    background: autoFilledFields.has('windDir') ? '#eff6ff' : undefined,
                  }}
                >
                  <option value="">— select —</option>
                  {WIND_DIRS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle()}>
                  Water temp (°C)
                  {autoFilledFields.has('waterTempC') && <AutoBadge />}
                </label>
                <input
                  type="number"
                  value={form.waterTempC}
                  onChange={(e) => set('waterTempC', e.target.value)}
                  placeholder="e.g. 14"
                  step={0.5}
                  style={{
                    ...inputStyle(),
                    borderColor: autoFilledFields.has('waterTempC') ? '#93c5fd' : undefined,
                    background: autoFilledFields.has('waterTempC') ? '#eff6ff' : undefined,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Equipment */}
          <div>
            <p style={sectionHeadingStyle()}>③ Equipment</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label style={labelStyle()}>Board</label>
                <select
                  value={form.boardType}
                  onChange={(e) => set('boardType', e.target.value)}
                  style={inputStyle({ appearance: 'auto' })}
                >
                  <option value="">— select —</option>
                  {lockerBoards.length > 0 && (
                    <optgroup label="My Gear Locker">
                      {lockerBoards.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}{b.lengthFt ? ` (${b.lengthFt})` : ''}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Generic">
                    {BOARD_TYPES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label style={labelStyle()}>Wetsuit</label>
                <select
                  value={form.wetsuitMm}
                  onChange={(e) => set('wetsuitMm', e.target.value)}
                  style={inputStyle({ appearance: 'auto' })}
                >
                  <option value="">— select —</option>
                  {lockerWetsuits.length > 0 && (
                    <optgroup label="My Gear Locker">
                      {lockerWetsuits.map((w) => (
                        <option key={w.id} value={w.name}>{w.name} ({w.thickness})</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Generic">
                    {WETSUIT_OPTIONS.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Session */}
          <div>
            <p style={sectionHeadingStyle()}>④ Session</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Rating */}
              <div>
                <label style={labelStyle()}>Rating</label>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set('rating', form.rating === n ? 0 : n)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        fontSize: '22px',
                        opacity: n <= form.rating ? 1 : 0.2,
                        transition: 'opacity 0.15s, transform 0.15s',
                        transform: n <= form.rating ? 'scale(1.1)' : 'scale(1)',
                      }}
                      title={`${n} star${n !== 1 ? 's' : ''}`}
                    >
                      🌊
                    </button>
                  ))}
                  {form.rating > 0 && (
                    <span style={{ fontSize: '13px', color: 'var(--text-3)', alignSelf: 'center', marginLeft: '4px' }}>
                      {['', 'Poor', 'Fair', 'Good', 'Great', 'Epic!'][form.rating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Buddies */}
              <div>
                <label style={labelStyle()}>Surfed with</label>
                <input
                  type="text"
                  value={form.buddies}
                  onChange={(e) => set('buddies', e.target.value)}
                  placeholder="e.g. Jake, Sarah"
                  style={inputStyle()}
                />
              </div>

              {/* Highlights */}
              <div>
                <label style={labelStyle()}>Highlights / Notes</label>
                <textarea
                  value={form.highlights}
                  onChange={(e) => set('highlights', e.target.value)}
                  placeholder="Best sets, conditions notes, anything memorable…"
                  rows={3}
                  style={{
                    ...inputStyle(),
                    resize: 'vertical',
                    fontFamily: 'DM Sans, sans-serif',
                    minHeight: '72px',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {submitError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
              }}
            >
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={mutation.isPending}
            style={{
              background: 'var(--ocean-600)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              opacity: mutation.isPending ? 0.6 : 1,
              width: '100%',
              transition: 'opacity 0.2s',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {mutation.isPending ? 'Logging session…' : '🌊 Log Session'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: SurfSession
  index: number
  total: number
  onDelete: (id: string) => void
  isDeleting: boolean
}

function SessionCard({ session, index, total, onDelete, isDeleting }: SessionCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const entryNumber = total - index

  const dateObj = parseISO(session.sessionDate)
  const dateLabel = format(dateObj, 'MMMM d, yyyy')

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Card top bar — entry number + rating */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--sand-50)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              background: 'var(--ocean-600)',
              color: 'white',
              borderRadius: '8px',
              padding: '3px 9px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'DM Sans, sans-serif',
              letterSpacing: '0.02em',
            }}
          >
            #{entryNumber}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{dateLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {session.rating !== null && session.rating > 0 && (
            <WaveRating value={session.rating} />
          )}
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Delete?</span>
              <button
                onClick={() => onDelete(session.id)}
                disabled={isDeleting}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  background: 'var(--sand-200)',
                  color: 'var(--text-2)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete session"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-3)',
                fontSize: '14px',
                padding: '2px 4px',
                borderRadius: '4px',
                transition: 'color 0.15s',
              }}
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Spot + duration */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div>
            <h3
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {session.spotName}
            </h3>
            {session.region && (
              <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
                📍 {session.region}
              </p>
            )}
          </div>
          {session.duration !== null && (
            <span
              style={{
                background: 'var(--ocean-100)',
                color: 'var(--ocean-700)',
                borderRadius: '20px',
                padding: '3px 10px',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              ⏱ {formatDuration(session.duration)}
            </span>
          )}
        </div>

        {/* Conditions row */}
        {(session.waveHeightFt !== null || session.windSpeed !== null || session.waterTempC !== null) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {session.waveHeightFt !== null && (
              <Chip>
                🌊 {session.waveHeightFt}ft
                {session.wavePeriod !== null ? ` @ ${session.wavePeriod}s` : ''}
              </Chip>
            )}
            {session.windSpeed !== null && (
              <Chip>
                💨 {session.windSpeed} km/h{session.windDir ? ` ${session.windDir}` : ''}
              </Chip>
            )}
            {session.waterTempC !== null && (
              <Chip>🌡 {session.waterTempC}°C</Chip>
            )}
          </div>
        )}

        {/* Equipment row */}
        {(session.boardType || session.wetsuitMm) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {session.boardType && <Chip variant="sand">🏄 {session.boardType}</Chip>}
            {session.wetsuitMm && <Chip variant="sand">🤿 {session.wetsuitMm}</Chip>}
          </div>
        )}

        {/* Highlights */}
        {session.highlights && (
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-2)',
              lineHeight: 1.55,
              margin: 0,
              background: 'var(--sand-50)',
              borderRadius: '8px',
              padding: '8px 10px',
              borderLeft: '3px solid var(--ocean-300)',
            }}
          >
            {session.highlights}
          </p>
        )}

        {/* Buddies */}
        {session.buddies && (
          <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: 0 }}>
            🤙 With {session.buddies}
          </p>
        )}
      </div>
    </div>
  )
}

function Chip({
  children,
  variant = 'ocean',
}: {
  children: React.ReactNode
  variant?: 'ocean' | 'sand'
}) {
  return (
    <span
      style={{
        background: variant === 'ocean' ? 'var(--ocean-50)' : 'var(--sand-100)',
        color: variant === 'ocean' ? 'var(--ocean-700)' : 'var(--text-2)',
        border: `1px solid ${variant === 'ocean' ? 'var(--ocean-200)' : 'var(--sand-200)'}`,
        borderRadius: '20px',
        padding: '3px 10px',
        fontSize: '12px',
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SessionsPageInner() {
  const searchParams = useSearchParams()
  const [sessions, setSessions] = useState<SurfSession[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [successBanner, setSuccessBanner] = useState(false)

  // Pre-fill from ?spot=&region=&slug= when coming from a spot page
  const prefill: Partial<FormState> = {
    spotName: searchParams.get('spot') ?? '',
    region: searchParams.get('region') ?? '',
  }
  const prefillSlug = searchParams.get('slug') ?? undefined
  const hasPrefill = !!searchParams.get('spot')

  useEffect(() => {
    if (hasPrefill) setModalOpen(true)
  }, [hasPrefill])

  // Load & sync from localStorage
  useEffect(() => {
    setSessions(getSessions())
    const handler = () => setSessions(getSessions())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = getSessions().filter((s) => s.id !== id)
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated))
      window.dispatchEvent(new Event('storage'))
    },
    onSuccess: () => setSessions(getSessions()),
  })

  const handleLogSuccess = () => {
    setSessions(getSessions())
    setSuccessBanner(true)
    setTimeout(() => setSuccessBanner(false), 3000)
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--sand-50)' }}>

        {/* Success banner */}
        {successBanner && (
          <div
            style={{
              position: 'fixed',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#16a34a',
              color: 'white',
              borderRadius: '12px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              zIndex: 100,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            🌊 Session logged!
          </div>
        )}

        {/* Page header */}
        <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto', padding: '28px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--ocean-600)',
                    marginBottom: '4px',
                  }}
                >
                  Personal Surf Journal
                </p>
                <h1
                  style={{
                    fontFamily: 'Playfair Display, serif',
                    fontSize: '30px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    margin: 0,
                    lineHeight: 1.15,
                  }}
                >
                  Surf Log
                </h1>
                <p style={{ fontSize: '14px', color: 'var(--text-3)', marginTop: '4px' }}>
                  {sessions.length === 0
                    ? 'Start logging your sessions'
                    : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} logged`}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  background: 'var(--ocean-600)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'opacity 0.2s',
                  flexShrink: 0,
                }}
              >
                + Log Session
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 20px' }}>
          {sessions.length === 0 ? (
            // Empty state
            <div
              style={{
                background: 'white',
                border: '2px dashed var(--border)',
                borderRadius: '20px',
                padding: '64px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📔</div>
              <h2
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: '8px',
                }}
              >
                Your log is empty
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-3)', marginBottom: '24px', maxWidth: '320px', margin: '0 auto 24px' }}>
                Every great surfer tracks their sessions. Log your first one to start building your surf history.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  background: 'var(--ocean-600)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 28px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Log your first session
              </button>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                {(
                  [
                    { label: 'Sessions', value: sessions.length.toString(), icon: '📔' },
                    {
                      label: 'Hours in water',
                      value: ((sessions.reduce((a, s) => a + (s.duration ?? 0), 0)) / 60).toFixed(1),
                      icon: '⏱',
                    },
                    {
                      label: 'Fav break',
                      value: (() => {
                        const counts = sessions.reduce<Record<string, number>>((a, s) => {
                          a[s.spotName] = (a[s.spotName] ?? 0) + 1
                          return a
                        }, {})
                        return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—'
                      })(),
                      icon: '📍',
                    },
                    {
                      label: 'Fav board',
                      value: (() => {
                        const counts = sessions.reduce<Record<string, number>>((a, s) => {
                          if (s.boardType) a[s.boardType] = (a[s.boardType] ?? 0) + 1
                          return a
                        }, {})
                        return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—'
                      })(),
                      icon: '🏄',
                    },
                  ] as { label: string; value: string; icon: string }[]
                ).map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      background: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: '14px',
                      padding: '14px 12px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '18px', marginBottom: '3px' }}>{stat.icon}</div>
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--text)',
                        fontFamily: 'Playfair Display, serif',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-3)',
                        marginTop: '1px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                      }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Logbook divider */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                  Log entries
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              {/* Session cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sessions.map((s, i) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    index={i}
                    total={sessions.length}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    isDeleting={deleteMutation.isPending}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <LogSessionModal
          onClose={() => setModalOpen(false)}
          onSuccess={handleLogSuccess}
          initialData={prefill}
          initialSlug={prefillSlug}
        />
      )}
    </>
  )
}

export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center" style={{ background: 'var(--sand-50)' }}>
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--ocean-500)] border-t-transparent" />
      </div>
    }>
      <SessionsPageInner />
    </Suspense>
  )
}
