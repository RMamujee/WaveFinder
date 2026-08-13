'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          textAlign: 'center',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontSize: '64px',
            fontWeight: 700,
            color: '#0284c7',
            lineHeight: 1,
            marginBottom: '16px',
          }}
        >
          ~
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontSize: '24px',
            fontWeight: 700,
            marginBottom: '10px',
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            color: '#475569',
            fontSize: '14px',
            marginBottom: '28px',
            maxWidth: '360px',
            lineHeight: 1.6,
          }}
        >
          {error?.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => reset()}
          style={{
            background: '#0284c7',
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
      </body>
    </html>
  )
}
