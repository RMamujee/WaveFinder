// Refuses to proceed unless DATABASE_URL points at a local database.
// Guards `npm run db:reset` (prisma db push --force-reset) from wiping a
// remote/prod database via a stray env var. Mirrors Prisma CLI env loading:
// process env first, then .env (no dotenv dep — parse the one line we need).
import { existsSync, readFileSync } from 'node:fs'

function fromDotenvFile(): string | undefined {
  if (!existsSync('.env')) return undefined
  const match = readFileSync('.env', 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m)
  return match?.[1]
}

const url = process.env.DATABASE_URL ?? fromDotenvFile()

if (!url) {
  // No URL at all → prisma itself will fail with a clear error; let it.
  process.exit(0)
}

let host: string
try {
  host = new URL(url).hostname
} catch {
  console.error('[assert-local-db] DATABASE_URL is not a parseable URL; refusing to continue.')
  process.exit(1)
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'db'])
if (!LOCAL_HOSTS.has(host)) {
  console.error(
    `[assert-local-db] DATABASE_URL points at "${host}" — refusing to run a destructive reset against a non-local database.\n` +
    'If you really mean to reset a remote database, run prisma directly without this guard.'
  )
  process.exit(1)
}
