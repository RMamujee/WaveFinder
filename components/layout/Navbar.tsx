'use client'

import Link from 'next/link'
import { useSession, signOut } from '@/lib/auth-client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

export function Navbar() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const navLinks = [
    { href: '/spots', label: 'Browse Spots', auth: false },
    { href: '/compare', label: 'Compare', auth: false },
    { href: '/sessions', label: 'My Log', auth: true },
    { href: '/dashboard', label: 'My Spots', auth: true },
  ].filter((l) => !l.auth || !!session?.user)

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'rgba(253,250,245,0.92)',
        backdropFilter: 'blur(12px)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group" onClick={() => setMobileOpen(false)}>
          <WaveFinderLogo />
          <span
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: 'Playfair Display, serif', color: 'var(--ocean-700)' }}
          >
            Wave<span style={{ color: 'var(--seafoam)', fontStyle: 'italic' }}>Finder</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? 'text-[var(--ocean-600)]'
                  : 'text-[var(--text-2)] hover:text-[var(--text)]'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right side: auth + mobile burger */}
        <div className="flex items-center gap-2">
          {/* Desktop auth */}
          <div className="hidden md:block">
            {session?.user ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition"
                  style={{ background: 'var(--sand-100)', color: 'var(--text-2)' }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--ocean-500)' }}
                  >
                    {session.user.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                  <span className="hidden sm:block">{session.user.name?.split(' ')[0]}</span>
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-44 rounded-xl py-1 shadow-lg"
                    style={{ background: 'white', border: '1px solid var(--border)' }}
                  >
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 text-sm transition hover:bg-[var(--sand-100)]"
                      style={{ color: 'var(--text)' }}
                      onClick={() => setMenuOpen(false)}
                    >
                      My Spots
                    </Link>
                    <button
                      onClick={() => signOut()}
                      className="w-full px-4 py-2 text-left text-sm transition hover:bg-[var(--sand-100)]"
                      style={{ color: 'var(--text-2)' }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
                  style={{ color: 'var(--text-2)' }}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: 'var(--ocean-600)' }}
                >
                  Sign up free
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="flex items-center justify-center rounded-lg p-2 md:hidden"
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
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="md:hidden border-t"
          style={{ background: 'rgba(253,250,245,0.97)', borderColor: 'var(--border)' }}
        >
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
                }}
              >
                {l.label}
              </Link>
            ))}

            <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              {session?.user ? (
                <>
                  <p className="px-3 py-1 text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                    {session.user.name}
                  </p>
                  <button
                    onClick={() => { signOut(); setMobileOpen(false) }}
                    className="w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[var(--sand-100)]"
                    style={{ color: 'var(--text-2)' }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <div className="flex gap-2 pt-1">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center rounded-lg px-3 py-2.5 text-sm font-medium border transition"
                    style={{ color: 'var(--text-2)', borderColor: 'var(--border)' }}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center rounded-lg px-3 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ background: 'var(--ocean-600)' }}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

function WaveFinderLogo() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Main wave */}
      <path
        d="M2 14 C5 9 8 7.5 11 10 C14 12.5 16 8 19 7 C22 6 25 8 28 10 C30 11.2 32 12 34 12"
        stroke="var(--ocean-500)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Second wave */}
      <path
        d="M2 20 C5 16 8 15 11 17 C14 19 16 15.5 19 14.5 C22 13.5 25 15.5 28 17 C30 18 32 18.5 34 18.5"
        stroke="var(--seafoam)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      {/* Fin / surfer silhouette hint */}
      <path
        d="M22 10 L20 16"
        stroke="var(--ocean-400)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Compass/finder dot */}
      <circle cx="34" cy="7" r="3" fill="var(--coral)" opacity="0.9" />
      <circle cx="34" cy="7" r="1.5" fill="white" />
    </svg>
  )
}
