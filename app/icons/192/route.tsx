import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

export function GET() {
  const img = readFileSync(join(process.cwd(), 'public/logo.png'))
  return new Response(img, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
