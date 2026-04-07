import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM = process.env.RESEND_FROM_EMAIL ?? 'WaveFinder <onboarding@resend.dev>'

export async function sendAlertEmail({
  to,
  spotName,
  rating,
  waveHeight,
  period,
  wind,
  date,
  slug,
}: {
  to: string
  spotName: string
  rating: string
  waveHeight: string
  period: string
  wind: string
  date: string
  slug: string
}) {
  if (!resend) {
    console.warn('RESEND_API_KEY not set — skipping alert email')
    return
  }

  const ratingColor = rating === 'epic' ? '#7c3aed' : '#16a34a'
  const ratingLabel = rating === 'epic' ? '🏆 EPIC' : '✅ GOOD'
  const url = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://wavefinder.app'}/spots/${slug}`

  await resend.emails.send({
    from: FROM,
    to,
    subject: `🌊 ${ratingLabel} conditions at ${spotName} — ${date}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; background: #fdfaf5; border-radius: 16px; overflow: hidden; border: 1px solid #ede0cc;">
        <div style="background: #0e4d88; padding: 24px 28px;">
          <p style="color: #7ec0f5; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 4px;">WaveFinder Alert</p>
          <h1 style="color: white; font-size: 22px; margin: 0; font-weight: 700;">${spotName}</h1>
        </div>
        <div style="padding: 24px 28px;">
          <div style="background: white; border: 2px solid ${ratingColor}20; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; text-align: center;">
            <p style="color: ${ratingColor}; font-size: 28px; font-weight: 900; margin: 0; letter-spacing: 0.05em;">${ratingLabel}</p>
            <p style="color: #8888aa; font-size: 13px; margin: 4px 0 0;">${date}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #ede0cc; color: #8888aa; font-size: 13px;">Wave Height</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #ede0cc; color: #1a1a2e; font-size: 14px; font-weight: 600; text-align: right;">${waveHeight}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #ede0cc; color: #8888aa; font-size: 13px;">Swell Period</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #ede0cc; color: #1a1a2e; font-size: 14px; font-weight: 600; text-align: right;">${period}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #8888aa; font-size: 13px;">Wind</td>
              <td style="padding: 10px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; text-align: right;">${wind}</td>
            </tr>
          </table>
          <a href="${url}" style="display: block; margin-top: 20px; background: #1362a8; color: white; text-align: center; padding: 12px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View Full Forecast →
          </a>
          <p style="color: #8888aa; font-size: 11px; text-align: center; margin-top: 16px;">
            Manage your alerts at <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://wavefinder.app'}/alerts" style="color: #1b7fcb;">wavefinder.app/alerts</a>
          </p>
        </div>
      </div>
    `,
  })
}
