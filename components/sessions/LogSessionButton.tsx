'use client'

import { useState } from 'react'
import { QuickLogModal } from './QuickLogModal'

export function LogSessionButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5"
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          color: 'var(--text)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
        }}
      >
        📓 Log a session
      </button>
      <QuickLogModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
