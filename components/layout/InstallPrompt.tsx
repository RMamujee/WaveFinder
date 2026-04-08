'use client'

import { useEffect, useState } from 'react'

/**
 * Shows a one-time iOS "Add to Home Screen" tip.
 * - Only renders on iOS Safari (not in standalone mode, not on Android/desktop)
 * - Dismissed permanently via localStorage
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = ('standalone' in navigator) && (navigator as { standalone?: boolean }).standalone === true
    const dismissed = localStorage.getItem('pwa-prompt-dismissed')
    if (isIOS && !isStandalone && !dismissed) {
      // Small delay so it doesn't pop immediately on page load
      const t = setTimeout(() => setShow(true), 2500)
      return () => clearTimeout(t)
    }
  }, [])

  if (!show) return null

  function dismiss() {
    localStorage.setItem('pwa-prompt-dismissed', '1')
    setShow(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Add WaveFinder to Home Screen"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        width: 'calc(100vw - 32px)',
        maxWidth: 360,
        background: '#0e4d88',
        color: 'white',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {/* Icon */}
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Add WaveFinder to Home Screen</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>
          Tap <strong>Share</strong> then <strong>Add to Home Screen</strong> for the full app experience.
        </p>
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: 'rgba(255,255,255,0.15)',
          border: 'none',
          borderRadius: 8,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          marginTop: -2,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
