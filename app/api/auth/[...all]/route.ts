import { NextResponse } from 'next/server'

// The account stack (better-auth + Stripe) is deliberately kept but dormant —
// the app is free and account-free. Everything under /api/auth stays
// unreachable unless ENABLE_ACCOUNTS is explicitly turned on, mirroring the
// ENABLE_DEBUG_API gate on /api/debug/conditions.
//
// better-auth is imported lazily *inside* the handler on purpose: `lib/auth`
// throws at module load when BETTER_AUTH_SECRET is missing in production, so a
// static import would turn this gated-off 404 into a 500 (and would force the
// secret to exist on a deployment that has no accounts at all).
async function handle(req: Request, method: 'GET' | 'POST') {
  if (process.env.ENABLE_ACCOUNTS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [{ auth }, { toNextJsHandler }] = await Promise.all([
    import('@/lib/auth'),
    import('better-auth/next-js'),
  ])
  return toNextJsHandler(auth)[method](req)
}

export async function GET(req: Request) {
  return handle(req, 'GET')
}

export async function POST(req: Request) {
  return handle(req, 'POST')
}
