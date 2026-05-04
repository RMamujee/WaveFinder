import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — WaveFinder',
  description: 'How WaveFinder handles your data.',
}

export default function PrivacyPage() {
  return (
    <article
      className="mx-auto max-w-3xl px-5 py-10 prose prose-sm"
      style={{ color: 'var(--text-2)' }}
    >
      <h1 style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-3)' }}>
        <em>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</em>
      </p>

      <h2>What we collect</h2>
      <p>
        WaveFinder is designed to collect as little as possible. Without a Pro account you can use the
        full free tier with zero data leaving your device — saved spots, sessions, and alert preferences
        live in your browser&rsquo;s local storage.
      </p>

      <h3>If you create a Pro account</h3>
      <ul>
        <li><strong>Email address</strong> — for sign-in, billing, and alert delivery.</li>
        <li><strong>Stripe customer ID</strong> — to manage your subscription and process payments.
          Card details are handled directly by Stripe; we never see them.</li>
        <li><strong>Saved spots, surf sessions, gear locker</strong> — synced server-side so they follow
          you across devices.</li>
      </ul>

      <h3>If you grant location access</h3>
      <p>
        Your coordinates are used in your browser to find nearby spots. We don&rsquo;t store them.
      </p>

      <h3>Anonymous usage analytics</h3>
      <p>
        We use Vercel Analytics and Vercel Speed Insights, both of which run cookieless and never
        identify individual users. They report aggregate page views and Core Web Vitals only.
      </p>

      <h2>What we don&rsquo;t do</h2>
      <ul>
        <li>We don&rsquo;t sell your data.</li>
        <li>We don&rsquo;t share your data with advertisers.</li>
        <li>We don&rsquo;t use third-party tracking pixels.</li>
      </ul>

      <h2>Data sources we display</h2>
      <p>
        Forecast data comes from <a href="https://open-meteo.com/">Open-Meteo</a> (CC-BY 4.0),{' '}
        <a href="https://www.ndbc.noaa.gov/">NOAA NDBC buoys</a>,{' '}
        <a href="https://api.tidesandcurrents.noaa.gov/api/prod/">NOAA CO-OPS tides</a>,
        USGS, and EPA. Webcam previews come from <a href="https://www.windy.com/">Windy.com</a> and
        YouTube. None of those services receive your identity from us.
      </p>

      <h2>Your rights</h2>
      <p>
        If you have a Pro account, you can export or delete all your data anytime from{' '}
        <a href="/dashboard">your dashboard</a>. For free users, clearing your browser&rsquo;s site data
        removes everything.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: email <a href="mailto:support@wavefinder.app">support@wavefinder.app</a>.
      </p>

      <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginTop: '2rem' }}>
        This is a plain-language summary, not a legal document. If you operate or use the service from
        a jurisdiction with specific privacy laws (GDPR, CCPA), the rights granted by those laws apply
        in addition to this policy.
      </p>
    </article>
  )
}
