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
        WaveFinder is designed to collect as little as possible. There are no accounts and nothing to
        pay for, so no saved surf data leaves your device: saved spots, sessions, and gear logs live in
        your browser&apos;s local storage.
      </p>

      <h3>Accounts created before WaveFinder went free</h3>
      <p>
        Sign-up and paid plans have been withdrawn. Records from that period — an email address,
        Better Auth session and verification rows, and Stripe customer and subscription IDs — may
        still exist. Card details were always held by Stripe; we never saw them. Email us to have any
        of it deleted.
      </p>

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
        <a href="https://api.tidesandcurrents.noaa.gov/api/prod/">NOAA CO-OPS tides</a>,{' '}
        <a href="https://www.pacioos.hawaii.edu/waves/model-global/">PacIOOS WaveWatch III</a>{' '}
        (NOAA WaveWatch III, hosted by the Pacific Islands Ocean Observing System at the
        University of Hawai&apos;i — used for the zoomed-out world map),
        USGS, and EPA. None of those services receive your account identity from us.
      </p>

      <h2>Your rights</h2>
      <p>
        Clearing your browser&apos;s site data removes the saved spots, sessions, and gear logs stored
        on this device. If you held an account before WaveFinder went free, you can request export or
        deletion of what remains of it.
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
