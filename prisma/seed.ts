import { PrismaClient } from '@prisma/client'
import { SURF_SPOTS_SEED } from '../lib/spots-data'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding surf spots...')

  for (const spot of SURF_SPOTS_SEED) {
    await prisma.surfSpot.upsert({
      where: { slug: spot.slug },
      update: spot,
      create: spot,
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
