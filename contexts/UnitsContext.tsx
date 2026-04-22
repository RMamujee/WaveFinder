'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { UnitSystem } from '@/lib/units'

interface UnitsContextValue {
  unit: UnitSystem
  toggle: () => void
}

const UnitsContext = createContext<UnitsContextValue>({ unit: 'imperial', toggle: () => {} })

const STORAGE_KEY = 'wavefinder-units'

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [unit, setUnit] = useState<UnitSystem>('imperial')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'metric' || saved === 'imperial') setUnit(saved)
  }, [])

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
