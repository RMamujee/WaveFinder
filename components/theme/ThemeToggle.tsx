'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'

type Theme = 'light' | 'offshore'

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem('wf_theme') as Theme | null
  if (stored === 'offshore' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'offshore' : 'light'
}

function applyTheme(t: Theme) {
  if (t === 'offshore') {
    document.documentElement.dataset.theme = 'offshore'
  } else {
    delete document.documentElement.dataset.theme
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const initial = getInitial()
    setTheme(initial)
    applyTheme(initial)
    setMounted(true)
  }, [])

  function toggle() {
    const next: Theme = theme === 'light' ? 'offshore' : 'light'
    setTheme(next)
    applyTheme(next)
    localStorage.setItem('wf_theme', next)
  }

  if (!mounted) return <div style={{ width: 34, height: 34 }} />

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={theme === 'light' ? 'Dark mode' : 'Light mode'}
      className="flex items-center justify-center rounded-lg transition-all"
      style={{
        width: 34,
        height: 34,
        background: theme === 'offshore' ? 'var(--sand-100)' : 'var(--ocean-50)',
        border: '1.5px solid var(--border)',
        color: theme === 'offshore' ? 'var(--ocean-200)' : 'var(--ocean-600)',
      }}
    >
      {theme === 'light'
        ? <Icon name="moon" size={16} strokeWidth={1.8} />
        : <Icon name="sun"  size={16} strokeWidth={1.8} />
      }
    </button>
  )
}
