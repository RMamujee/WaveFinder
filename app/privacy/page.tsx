import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - WaveFinder',
  description: 'How WaveFinder handles your data.',
}

export default function PrivacyPage() {
  return (
    <article
      className="mx-auto max-w-3xl px-5 py-10 prose prose-sm"
      style={{ color: 'var(--text-2)' }}
    >
      <h1 style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--text)' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-3)' }}>
        <em>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</em>
      </p>

      <h2>What we collect</h2>
      <p>
        WaveFinder is designed to collect as little as possible. Without an account you can use the
        full free tier with zero saved surf data leaving your device. Saved spots, sessions, and gear
        logs live in your browser&apos;s local storage.
      </p>

      <h3>If you create an account or start a Pro trial</h3>
      <ul>
        <li><strong>Email address</strong> - for sign-in, billing, and service messages.</li>
        <li><strong>Authentication records</strong> - session, account, and verification records handled by Better Auth.</li>
        <li><strong>Stripe customer and subscription IDs</strong> - to manage the 7-day trial, monthly subscription, invoices, and cancellation. Card details are handled directly by Stripe; we never see them.</li>
        <li><strong>Saved spots, surf sessions, and gear locker</strong> - synced server-side only when account sync features are enabled.</li>
      </ul>

      <h3>If you grant location access</h3>
      <p>
        Your coordinates are used in your browser to find nearby spots. We do not store them.
      </p>

      <h3>Analytics and monitoring</h3>
      <p>
        We use Vercel Analytics and Vercel Speed Insights for aggregate performance data. We also log
        security, billing, and uptime events such as webhook failures, checkout creation, and database
        health errors. Monitoring logs may include account IDs or Stripe IDs needed to debug a specific
        issue, but not payment card data.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your data.</li>
        <li>We do not share your data with advertisers.</li>
        <li>We do not use third-party tracking pixels.</li>
      </ul>

      <h2>Data sources we display</h2>
      <p>
        Forecast data comes from <a href="https://open-meteo.com/">Open-Meteo</a>,{' '}
        <a href="https://www.ndbc.noaa.gov/">NOAA NDBC buoys</a>,{' '}
        <a href="https://api.tidesandcurrents.noaa.gov/api/prod/">NOAA CO-OPS tides</a>,
        USGS, and EPA. None of those services receive your account identity from us.
      </p>

      <h2>Your rights</h2>
      <p>
        If you have an account, you can request export or deletion of your account data. For free users,
        clearing your browser&apos;s site data removes locally stored saved spots, sessions, and gear logs.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: email <a href="mailto:support@wavefinder.app">support@wavefinder.app</a>.
      </p>

      <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginTop: '2rem' }}>
        This is a plain-language summary, not individualized legal advice. Rights granted by privacy
        laws such as GDPR or CCPA apply where those laws cover you.
      </p>
    </article>
  )
}
