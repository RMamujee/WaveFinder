import { Redis } from '@upstash/redis'

// Single source of truth for the Upstash client so the rate limiter, webhook
// idempotency, and health check can never disagree about which Redis (if any)
// is configured. Env aliases: native Upstash vars take precedence, then the
// Vercel KV integration names, then the project-scoped storage names.
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ??
  process.env.KV_REST_API_URL ??
  process.env.WaveFinderStorage_KV_REST_API_URL
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ??
  process.env.KV_REST_API_TOKEN ??
  process.env.WaveFinderStorage_KV_REST_API_TOKEN

export const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null
