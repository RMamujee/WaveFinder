import Link from 'next/link'

export default function NotFound() {
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
          fontSize: '80px',
          fontWeight: 700,
          color: 'var(--ocean-600)',
          lineHeight: 1,
          marginBottom: '16px',
        }}
      >
        404
      </p>
      <h1
        style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '26px',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: '10px',
        }}
      >
        Spot not found
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: '14px', marginBottom: '28px', maxWidth: '360px', lineHeight: 1.6 }}>
        This page doesn&apos;t exist — the URL might be wrong or the spot may have moved.
      </p>
      <Link
        href="/spots"
        style={{
          background: 'var(--ocean-600)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '12px',
          padding: '10px 28px',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        Browse all spots
      </Link>
    </div>
  )
}
