const baseUrl = process.env.SMOKE_BASE_URL ?? 'https://wave-finder.vercel.app'

async function request(path: string) {
  return fetch(`${baseUrl}${path}`, {
    headers: { 'User-Agent': 'WaveFinder smoke test' },
  })
}

async function assertStatus(path: string, expected: number) {
  const res = await request(path)
  if (res.status !== expected) {
    const body = await res.text().catch(() => '')
    throw new Error(`${path} returned ${res.status}, expected ${expected}. ${body.slice(0, 200)}`)
  }
  return res
}

async function main() {
  await assertStatus('/', 200)
  await assertStatus('/api/health', 200)
  await assertStatus('/api/debug/conditions', 404)

  let saw429 = false
  for (let i = 0; i < 12; i++) {
    const res = await request('/api/debug/conditions')
    if (res.status === 429) {
      const limit = res.headers.get('x-ratelimit-limit')
      if (limit !== '10') throw new Error(`Expected debug limit 10, got ${limit ?? 'missing'}`)
      saw429 = true
      break
    }
  }

  if (!saw429) throw new Error('Expected /api/debug/conditions to hit the debug rate limit')
  console.log(`Smoke test passed for ${baseUrl}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
