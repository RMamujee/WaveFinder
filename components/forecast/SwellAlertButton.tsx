'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from '@/components/ui/Icon'
import type { ForecastDay } from '@/types/forecast'

const STORAGE_KEY = 'wf-swell-alerts'

interface AlertConfig {
  spotName: string
  minWaveHeightM: number
  minPeriodS: number
  lastNotifiedDate: string | null
}

function loadAlerts(): Record<string, AlertConfig> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}
function saveAlerts(a: Record<string, AlertConfig>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(a))
}

interface Props {
  spotSlug: string
  spotName: string
  forecastDays: ForecastDay[] | undefined
}

export function SwellAlertButton({ spotSlug, spotName, forecastDays }: Props) {
  const [open, setOpen]                 = useState(false)
  const [config, setConfig]             = useState<AlertConfig | null>(null)
  const [triggered, setTriggered]       = useState(false)
  const [minWaveHeightM, setMinWH]      = useState(1.0)
  const [minPeriodS, setMinPeriod]      = useState(12)
  const wrapRef                         = useRef<HTMLDivElement>(null)

  // Load saved alert from localStorage
  useEffect(() => {
    const saved = loadAlerts()[spotSlug]
    if (saved) {
      setConfig(saved)
      setMinWH(saved.minWaveHeightM)
      setMinPeriod(saved.minPeriodS)
    }
  }, [spotSlug])

  // Check 48-hour forecast against threshold and fire notification once per day
  useEffect(() => {
    if (!config || !forecastDays?.length) return
    // Local date in the user's timezone — toISOString() returns UTC, which
    // skips notifications the morning after a late-evening trigger for users
    // in negative offsets.
    const d = new Date()
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (config.lastNotifiedDate === todayStr) { setTriggered(true); return }

    const hours = forecastDays.slice(0, 2).flatMap((d) => d.hours)
    // Skip long-range fallback hours — those substitute total wave for swell
    // and would fire on wind-chop days that look like clean groundswell.
    const hit = hours.find(
      (h) => !h.isLongRange && h.waveHeight >= config.minWaveHeightM && h.swellPeriod >= config.minPeriodS
    )
    if (!hit) return

    setTriggered(true)

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    const timeStr = new Date(hit.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    new Notification(`Swell alert: ${spotName}`, {
      body: `${hit.waveHeight.toFixed(1)}m @ ${Math.round(hit.swellPeriod)}s expected at ${timeStr}`,
      icon: '/icon.png',
      tag: `swell-${spotSlug}`,
    })

    const alerts = loadAlerts()
    if (alerts[spotSlug]) {
      alerts[spotSlug].lastNotifiedDate = todayStr
      saveAlerts(alerts)
    }
  }, [config, forecastDays, spotSlug, spotName])

  // Close popover on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function saveAlert() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const newConfig: AlertConfig = { spotName, minWaveHeightM, minPeriodS, lastNotifiedDate: null }
    const alerts = loadAlerts()
    alerts[spotSlug] = newConfig
    saveAlerts(alerts)
    setConfig(newConfig)
    setTriggered(false)
    setOpen(false)
  }

  function removeAlert() {
    const alerts = loadAlerts()
    delete alerts[spotSlug]
    saveAlerts(alerts)
    setConfig(null)
    setTriggered(false)
    setOpen(false)
  }

  const isSet = !!config
  const ftLabel = (m: number) => `${Math.round(m * 3.281)}ft`

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={isSet ? 'Manage swell alert' : 'Set swell alert'}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-80"
        style={{
          background: triggered ? '#fef3c7' : isSet ? 'var(--ocean-50)' : 'var(--sand-100)',
          border: `1px solid ${triggered ? '#f59e0b' : isSet ? 'var(--ocean-300)' : 'var(--border)'}`,
          color: triggered ? '#92400e' : isSet ? 'var(--ocean-700)' : 'var(--text-2)',
        }}
      >
        <Icon name="bell" size={12} />
        {triggered ? 'Swell!' : isSet ? 'Alert on' : 'Swell alert'}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-4 shadow-xl"
          style={{ background: 'white', border: '1px solid var(--border)', width: 252 }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Swell alert</p>

          <div className="mb-3">
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>
              Wave height ≥ {ftLabel(minWaveHeightM)} ({minWaveHeightM.toFixed(1)}m)
            </label>
            <input
              type="range" min={0.5} max={4} step={0.5}
              value={minWaveHeightM}
              onChange={(e) => setMinWH(Number(e.target.value))}
              className="w-full accent-[var(--ocean-600)]"
            />
            <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              <span>2ft</span><span>13ft</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>
              Swell period ≥ {minPeriodS}s
            </label>
            <input
              type="range" min={8} max={16} step={1}
              value={minPeriodS}
              onChange={(e) => setMinPeriod(Number(e.target.value))}
              className="w-full accent-[var(--ocean-600)]"
            />
            <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              <span>8s wind swell</span><span>16s ground</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveAlert}
              className="flex-1 rounded-lg py-2 text-xs font-semibold text-white"
              style={{ background: 'var(--ocean-600)' }}
            >
              {isSet ? 'Update alert' : 'Set alert'}
            </button>
            {isSet && (
              <button
                onClick={removeAlert}
                className="rounded-lg px-3 py-2 text-xs font-medium"
                style={{ background: 'var(--sand-100)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs mt-2.5" style={{ color: 'var(--text-3)' }}>
            Checks next 48 hours · requires browser permission
          </p>
        </div>
      )}
    </div>
  )
}
