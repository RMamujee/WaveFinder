'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useUnits } from '@/contexts/UnitsContext'

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { unit, toggle } = useUnits()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const navLinks = [
    { href: '/spots',     label: 'Browse Spots' },
    { href: '/timeline',  label: 'Timeline' },
    { href: '/regions',   label: 'Regions' },
    { href: '/compare',   label: 'Compare' },
    { href: '/sessions',  label: 'My Log' },
    { href: '/dashboard', label: 'My Spots' },
    { href: '/gear',      label: 'Gear Locker' },
    { href: '/pricing',   label: 'Pricing' },
    { href: '/sign-in',   label: 'Sign in' },
  ]

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{ background: 'rgba(253,250,245,0.92)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group" onClick={() => setMobileOpen(false)}>
          <Image src="/logo.png" alt="WaveFinder" width={36} height={36} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--ocean-700)' }}>
            Wave<span style={{ color: 'var(--seafoam)', fontStyle: 'italic' }}>Finder</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                isActive(l.href) ? 'text-[var(--ocean-600)]' : 'text-[var(--text-2)] hover:text-[var(--text)]'
              }`}
            >
              {l.label}
            </Link>
          ))}
          {/* Units toggle */}
          <button
            onClick={toggle}
            className="flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
            style={{
              background: unit === 'imperial' ? 'var(--ocean-50)' : 'var(--sand-100)',
              border: `1.5px solid ${unit === 'imperial' ? 'var(--ocean-300)' : 'var(--border)'}`,
              color: unit === 'imperial' ? 'var(--ocean-700)' : 'var(--text-2)',
            }}
            title={`Switch to ${unit === 'imperial' ? 'metric' : 'imperial'} units`}
          >
            {unit === 'imperial' ? 'mi/ft/°F' : 'km/m/°C'}
          </button>
        </div>

        {/* Mobile: Made by credit */}
        <a
          href="https://www.linkedin.com/in/rmamujee"
          target="_blank"
          rel="noopener noreferrer"
          className="md:hidden text-xs font-medium"
          style={{ color: 'var(--text-3)' }}
        >
          by Rahil Mamujee
        </a>

        {/* Mobile hamburger */}
        <button
          className="flex items-center justify-center rounded-lg p-2.5 md:hidden"
          style={{ color: 'var(--text-2)' }}
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t" style={{ background: 'rgba(253,250,245,0.97)', borderColor: 'var(--border)' }}>
          <div className="px-5 py-3 space-y-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium transition"
                style={{
                  color: isActive(l.href) ? 'var(--ocean-600)' : 'var(--text)',
                  background: isActive(l.href) ? 'var(--ocean-50)' : 'transparent',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {l.label}
              </Link>
            ))}
            {/* Units toggle row */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Units</span>
              <button
                onClick={toggle}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: unit === 'imperial' ? 'var(--ocean-50)' : 'var(--sand-100)',
                  border: `1.5px solid ${unit === 'imperial' ? 'var(--ocean-300)' : 'var(--border)'}`,
                  color: unit === 'imperial' ? 'var(--ocean-700)' : 'var(--text-2)',
                }}
              >
                {unit === 'imperial' ? 'mi / ft / °F' : 'km / m / °C'}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
