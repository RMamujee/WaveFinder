import { PrismaClient } from '@prisma/client'
import { SURF_SPOTS_SEED } from '../lib/spots-data'
import { PARKING_DATA } from '../lib/parking-data'

const prisma = new PrismaClient()

// Seed fields the SurfSpot table has no column for. `bottomType` is read from
// the in-memory static store, not from Postgres — the table is transitional,
// kept only for the legacy cuid bridge — so it must be dropped before upsert
// or Prisma throws "Unknown argument 'bottomType'" at runtime.
//
// TypeScript will not catch this: excess-property checking applies to object
// literals passed directly to a typed parameter, not to a variable. Keep this
// list in step with the seed; tests/spots-seed.test.ts diffs it against
// schema.prisma so a new seed-only field fails the suite instead of the seed.
const SEED_ONLY_FIELDS = ['bottomType'] as const

function toColumns<T extends Record<string, unknown>>(spot: T): Omit<T, typeof SEED_ONLY_FIELDS[number]> {
  const columns: Record<string, unknown> = { ...spot }
  for (const field of SEED_ONLY_FIELDS) delete columns[field]
  return columns as Omit<T, typeof SEED_ONLY_FIELDS[number]>
}

async function main() {
  console.log('Seeding surf spots...')

  for (const spot of SURF_SPOTS_SEED) {
    const parkingOptions = PARKING_DATA[spot.slug] ?? null
    const data = {
      ...toColumns(spot),
      // Prisma Json fields require casting through unknown
      parkingOptions: parkingOptions ? (parkingOptions as unknown as import('@prisma/client').Prisma.InputJsonValue) : undefined,
    }
    await prisma.surfSpot.upsert({
      where: { slug: spot.slug },
      update: data,
      create: data,
    })
    console.log(`  ✓ ${spot.name}`)
  }

  console.log(`Done! Seeded ${SURF_SPOTS_SEED.length} surf spots.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
