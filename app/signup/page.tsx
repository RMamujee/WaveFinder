'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signUp } from '@/lib/auth-client'

export default function SignupPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signUp.email({ name, email, password })
    if (result.error) {
      setError(result.error.message ?? 'Failed to create account')
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4" style={{ background: 'var(--sand-50)' }}>
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 opacity-10">
        <svg viewBox="0 0 1440 120" fill="none">
          <path d="M0,60 C240,100 480,20 720,60 C960,100 1200,20 1440,60 L1440,120 L0,120 Z" fill="var(--ocean-500)" />
        </svg>
      </div>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <svg width="32" height="22" viewBox="0 0 28 20" fill="none">
              <path d="M2 10C4.5 6.5 7 5 10 7C13 9 15.5 5 19 5C22.5 5 25 7 26 8" stroke="var(--ocean-500)" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M2 15C4.5 12 7 10.5 10 12.5C13 14.5 15.5 11 19 11C22.5 11 25 13 26 14" stroke="var(--seafoam)" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
            </svg>
          </Link>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
            Join <span style={{ color: 'var(--ocean-600)', fontStyle: 'italic' }}>WaveFinder</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>Free forever. Save spots, track conditions.</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'white', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Name', type: 'text', value: name, set: setName, placeholder: 'Your name', auto: 'name' },
              { label: 'Email', type: 'email', value: email, set: setEmail, placeholder: 'you@example.com', auto: 'email' },
              { label: 'Password', type: 'password', value: password, set: setPassword, placeholder: 'Min. 8 characters', auto: 'new-password', min: 8 },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>{f.label}</label>
                <input
                  type={f.type} value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  required minLength={f.min} autoComplete={f.auto}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  style={{ background: 'var(--sand-50)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
                  placeholder={f.placeholder}
                />
              </div>
            ))}

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: 'var(--ocean-600)' }}
            >
              {loading ? 'Creating account…' : 'Create free account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-3)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--ocean-600)', fontWeight: 500 }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
