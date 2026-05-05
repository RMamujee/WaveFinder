# WaveFinder Deployment

## Production

- Vercel project: `wave-finder`
- Production URL: `https://wave-finder.vercel.app`
- Upstash Redis resource: `upstash-kv-green-flower`
- Upstash ID: `81f2d78b-60c5-4343-be50-91b93d3d6761`

## Required Environment Variables

The Vercel project must have these variables available in Production and Preview unless noted.

### App and database

- `DATABASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `SESSION_SECRET` - Production only

### External APIs

- `YOUTUBE_API_KEY`
- `WINDY_WEBCAM_API_KEY`

### Rate limiting

Vercel's Upstash integration currently prefixes the Redis variables with `WaveFinderStorage_`.

- `WaveFinderStorage_KV_REST_API_URL`
- `WaveFinderStorage_KV_REST_API_TOKEN`

The proxy also supports the generic Vercel KV names and native Upstash SDK names:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Rate Limits

Limits are per IP, per API path, per minute.

- `/api/debug/*`: 10
- `/api/webcams/*`: 20
- `/api/water-quality/*`: 30
- `/api/best-spots`: 30
- `/api/forecast/*`: 45
- `/api/surf-reports/*`: 45
- `/api/alerts/*`: 60
- `/api/health`: 120
- `/api/spots*`: 120
- Other `/api/*`: 80

## Verification

Run local checks before deploying:

```bash
npm audit --audit-level=low
npm run lint
npm run build
```

After production deploy, run:

```bash
npm run smoke:prod
```

The smoke test checks the homepage, database health, debug endpoint lockout, and Redis-backed rate limiting on `/api/debug/conditions`.
