import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/lib/prisma'
import { monitor } from '@/lib/monitoring'

const secret = process.env.BETTER_AUTH_SECRET
// Enforce a strong secret at runtime in production, but never during `next build`
// (NODE_ENV is 'production' while collecting page data, where env may be absent).
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
if (process.env.NODE_ENV === 'production' && !isBuildPhase && (!secret || secret.length < 32)) {
  throw new Error('BETTER_AUTH_SECRET must be set and at least 32 characters in production.')
}

const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
].filter((origin): origin is string => Boolean(origin))

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret,
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  // Set requireEmailVerification: true once RESEND_API_KEY is configured in production.
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM ?? 'WaveFinder <onboarding@resend.dev>',
            to: user.email,
            subject: 'Verify your WaveFinder email',
            html: `<p>Confirm your email to finish setting up WaveFinder.</p><p><a href="${url}">Verify email</a></p>`,
          }),
        })
      } else {
        // Never log the verification URL or the address: the URL is a live
        // credential (anyone reading the platform logs could verify the
        // account) and the address is PII. Record only that the mail could not
        // be sent, keyed by the opaque user id.
        monitor('warn', 'email_verification.unsent_no_provider', { userId: user.id })
      }
    },
  },
})
