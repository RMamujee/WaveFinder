import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service - WaveFinder',
  description: 'Terms governing your use of WaveFinder.',
}

export default function TermsPage() {
  return (
    <article
      className="mx-auto max-w-3xl px-5 py-10 prose prose-sm"
      style={{ color: 'var(--text-2)' }}
    >
      <h1 style={{ fontFamily: 'var(--font-playfair), serif', color: 'var(--text)' }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-3)' }}>
        <em>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</em>
      </p>

      <h2>Use the service at your own risk</h2>
      <p>
        WaveFinder shows forecasts derived from third-party models. Forecasts are not guarantees.
        Always check actual conditions, lifeguard advisories, local rules, and your own ability before
        entering the water. We are not responsible for accidents, injuries, or losses related to your
        decisions about when, where, or whether to surf.
      </p>

      <h2>Free, with no account</h2>
      <p>
        Every feature is free and none of them requires an account or payment. Saved spots, surf
        sessions, and your gear locker are stored in your own browser, not on our servers. We may
        rate-limit excessive automated traffic to keep the service available for everyone.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not scrape the API at scale, attempt to bypass rate limits, or resell our forecasts as a
        commercial weather product. The data we display is licensed from third parties; we are not the
        rights holder, so we cannot grant you those rights either.
      </p>

      <h2>Enforcement</h2>
      <p>
        We may block or rate-limit traffic that violates these terms or abuses the service.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If we make material changes, we will post the updated terms on this page. Continuing to use
        the service after changes take effect constitutes acceptance.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: email <a href="mailto:support@wavefinder.app">support@wavefinder.app</a>.
      </p>

      <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginTop: '2rem' }}>
        These terms are written in plain English to be readable; they are not a substitute for
        individualized legal advice.
      </p>
    </article>
  )
}
