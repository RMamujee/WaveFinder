import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}

  // 1. Database
  try {
    const count = await prisma.surfSpot.count()
    results.database = { ok: true, spotCount: count }
  } catch (e) {
    results.database = { ok: false, error: String(e) }
  }

  // 2. Open-Meteo marine (Santa Monica coordinates)
  try {
    const url = 'https://marine-api.open-meteo.com/v1/marine?latitude=34.01&longitude=-118.5&hourly=wave_height,wave_period&forecast_days=1&timezone=auto'
    const res = await fetch(url, { cache: 'no-store' })
    const body = await res.json()
    results.openMeteoMarine = {
      ok: res.ok,
      status: res.status,
      hasData: !!body?.hourly?.wave_height?.length,
      firstWaveHeight: body?.hourly?.wave_height?.[0],
    }
  } catch (e) {
    results.openMeteoMarine = { ok: false, error: String(e) }
  }

  // 3. Open-Meteo wind
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=34.01&longitude=-118.5&hourly=wind_speed_10m&wind_speed_unit=kmh&forecast_days=1&timezone=auto'
    const res = await fetch(url, { cache: 'no-store' })
    const body = await res.json()
    results.openMeteoWind = {
      ok: res.ok,
      status: res.status,
      hasData: !!body?.hourly?.wind_speed_10m?.length,
    }
  } catch (e) {
    results.openMeteoWind = { ok: false, error: String(e) }
  }

  // 4. NOAA buoy (nearby buoy 46025 — Santa Monica)
  try {
    const res = await fetch('https://www.ndbc.noaa.gov/data/realtime2/46025.txt', { cache: 'no-store' })
    const text = await res.text()
    results.noaaBuoy = {
      ok: res.ok,
      status: res.status,
      hasData: text.split('\n').length > 3,
    }
  } catch (e) {
    results.noaaBuoy = { ok: false, error: String(e) }
  }

  // 5. NOAA tides (station 9410660 — Los Angeles)
  try {
    const today = new Date()
    const end = new Date(today); end.setDate(today.getDate() + 1)
    const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${fmt(today)}&end_date=${fmt(end)}&station=9410660&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=hilo&units=metric&application=surf_forecast_app&format=json`
    const res = await fetch(url, { cache: 'no-store' })
    const body = await res.json()
    results.noaaTides = {
      ok: res.ok,
      status: res.status,
      hasData: !!body?.predictions?.length,
      error: body?.error?.message,
    }
  } catch (e) {
    results.noaaTides = { ok: false, error: String(e) }
  }

  const allOk = Object.values(results).every((r) => (r as { ok: boolean }).ok)

  return NextResponse.json({ status: allOk ? 'healthy' : 'degraded', results }, {
    status: allOk ? 200 : 207,
  })
}
