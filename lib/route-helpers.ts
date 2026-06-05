import { NextResponse } from 'next/server'
import { monitor } from '@/lib/monitoring'

export function handleRouteError(error: unknown, event: string) {
  // Pass the raw error so monitor() can forward an Error (with stack) to Sentry
  // as a captured exception; non-Error values still log/serialize cleanly.
  monitor('error', event, { error })
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
