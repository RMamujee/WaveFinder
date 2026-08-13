'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { UnitSystem } from '@/lib/units'

interface UnitsContextValue {
  unit: UnitSystem
  toggle: () => void
}

const UnitsContext = createContext<UnitsContextValue>({ unit: 'imperial', toggle: () => {} })

const STORAGE_KEY = 'wavefinder-units'

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [unit, setUnit] = useState<UnitSystem>(() => {
    if (typeof window === 'undefined') return 'imperial'
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'metric' || saved === 'imperial' ? saved : 'imperial'
  })

  const toggle = () => {
    setUnit((u) => {
      const next: UnitSystem = u === 'imperial' ? 'metric' : 'imperial'
      try { localStorage.setItem(STORAGE_KEY, next) } catch { /* quota */ }
      return next
    })
  }

  return <UnitsContext.Provider value={{ unit, toggle }}>{children}</UnitsContext.Provider>
}

export function useUnits() {
  return useContext(UnitsContext)
}
