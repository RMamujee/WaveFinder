'use client'

import { useState, useEffect } from 'react'
import { migrateSavedSpots } from '@/lib/spots/saved-spots-migration'

const SAVED_KEY = 'wavefinder_saved'

function getSavedIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function SaveSpotButton({ spotId }: { spotId: string }) {
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    let active = true
    // Migrate any legacy cuid saved ids to slugs before checking membership, so
    // the saved state matches the now slug-based spotId. Idempotent + failure-
    // safe. Re-check after it resolves regardless of outcome.
    migrateSavedSpots().finally(() => {
      if (active) setIsSaved(getSavedIds().includes(spotId))
    })
    return () => { active = false }
  }, [spotId])

  const handleClick = () => {
    const saved = getSavedIds()
    try {
      if (isSaved) {
        localStorage.setItem(SAVED_KEY, JSON.stringify(saved.filter((id) => id !== spotId)))
        setIsSaved(false)
      } else {
        localStorage.setItem(SAVED_KEY, JSON.stringify([...saved, spotId]))
        setIsSaved(true)
      }
    } catch {
      // QuotaExceededError — storage full, skip persisting
    }
    window.dispatchEvent(new Event('storage'))
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
