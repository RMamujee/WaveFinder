'use client'

import Link from 'next/link'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '64px',
          fontWeight: 700,
          color: 'var(--ocean-600)',
          lineHeight: 1,
          marginBottom: '16px',
        }}
      >
        ~
      </p>
      <h1
        style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: '10px',
        }}
      >
        Something went wrong
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: '14px', marginBottom: '28px', maxWidth: '360px', lineHeight: 1.6 }}>
        {error?.message || 'An unexpected error occurred.'}
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={reset}
          style={{
            background: 'var(--ocean-600)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            background: 'var(--sand-100)',
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
