import { PrismaClient } from '@prisma/client'
import { SURF_SPOTS_SEED } from '../lib/spots-data'
import { PARKING_DATA } from '../lib/parking-data'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding surf spots...')

  for (const spot of SURF_SPOTS_SEED) {
    const parkingOptions = PARKING_DATA[spot.slug] ?? null
    const data = {
      ...spot,
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
