import { fromZonedTime } from 'date-fns-tz'

import type { AppointmentStatus } from '@/contract/appointment'
import { naiveLocalIso, todayInShop } from '@/scheduling/day-range'

/** Two weeks either side of today, per the seed spec in ticket #1. */
const DAY_SPAN = 14

const OPEN_MINUTE = 9 * 60
const CLOSE_MINUTE = 18 * 60

interface ServiceSpine {
  id: string
  durationMinutes: number
}

interface AppointmentSeed {
  id: string
  shopId: string
  barberId: string
  customerId: string
  serviceId: string
  start: string
  status: AppointmentStatus
}

/**
 * A tiny seeded PRNG (mulberry32), not `Math.random`. The seed is reset per
 * shop-load, so the mock's data must be the same on every run — a
 * `Math.random` volume would make a test that happened to look at "today"
 * flaky the day the numbers came up differently.
 */
function mulberry32(seed: number): () => number {
  let state = seed

  return function random() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFor(...parts: Array<string | number>): number {
  const text = parts.join(':')
  let hash = 0

  for (let i = 0; i < text.length; i++) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0
  }

  return hash >>> 0
}

/** The Shop-local calendar date, read at the moment the seed is built. */
export function todayInShopTimezone(shopTimezone: string): { year: number; month: number; day: number } {
  const [year, month, day] = todayInShop(shopTimezone).split('-').map(Number) as [number, number, number]

  return { year, month: month - 1, day }
}

/**
 * The wall-clock instant for a given number of minutes past midnight, on the
 * given day, in the Shop's timezone — per ADR-0002, Working Hours-shaped
 * arithmetic never goes through the viewer's own timezone.
 */
export function instantAt(shopTimezone: string, year: number, month: number, day: number, minute: number): Date {
  const hours = Math.floor(minute / 60)
  const minutes = minute % 60

  return fromZonedTime(naiveLocalIso(year, month, day, hours, minutes), shopTimezone)
}

/**
 * A day's worth of Appointments for one Barber: busiest on Saturday, quiet on
 * Sunday, moderate the rest of the week — "a busy Saturday is designed for
 * rather than discovered," per ticket #1. Appointments are packed
 * back-to-back with a short random gap, so the list looks like a real day
 * rather than a scatter of unrelated times.
 */
function appointmentsForBarberOnDay({
  shopId,
  shopTimezone,
  barberId,
  services,
  customerIds,
  year,
  month,
  day,
  weekday,
  dayOffset,
}: {
  shopId: string
  shopTimezone: string
  barberId: string
  services: readonly ServiceSpine[]
  customerIds: readonly string[]
  year: number
  month: number
  day: number
  weekday: number
  dayOffset: number
}): AppointmentSeed[] {
  // Closed Sundays, in this fixture.
  if (weekday === 0) {
    return []
  }

  const random = mulberry32(seedFor(barberId, dayOffset))
  const isSaturday = weekday === 6
  const targetCount = isSaturday ? 6 + Math.floor(random() * 3) : 2 + Math.floor(random() * 4)

  const appointments: AppointmentSeed[] = []
  let cursor = OPEN_MINUTE
  let created = 0

  while (created < targetCount) {
    const service = services[Math.floor(random() * services.length)]!

    if (cursor + service.durationMinutes > CLOSE_MINUTE) {
      break
    }

    const customerId = customerIds[Math.floor(random() * customerIds.length)]!
    const start = instantAt(shopTimezone, year, month, day, cursor)

    appointments.push({
      id: `appointment-${barberId}-${dayOffset}-${created}`,
      shopId,
      barberId,
      customerId,
      serviceId: service.id,
      start: start.toISOString(),
      // A handful of Cancelled Appointments in the volume, so "Cancelled
      // Appointments are visually distinct" has more than the hand-placed
      // fixture below to be true of.
      status: random() < 0.08 ? 'cancelled' : 'scheduled',
    })

    created++
    cursor += service.durationMinutes + 5 + Math.floor(random() * 25)
  }

  return appointments
}

/**
 * Several hundred Appointments spanning roughly two weeks either side of
 * today, computed relative to today at seed time per ticket #1 — a fresh
 * clone is never empty tomorrow, and never stale a month from now.
 */
export function generateAppointments({
  shopId,
  shopTimezone,
  barberIds,
  services,
  customerIds,
}: {
  shopId: string
  shopTimezone: string
  barberIds: readonly string[]
  services: readonly ServiceSpine[]
  customerIds: readonly string[]
}): AppointmentSeed[] {
  const { year, month, day: today } = todayInShopTimezone(shopTimezone)

  const appointments: AppointmentSeed[] = []

  for (let dayOffset = -DAY_SPAN; dayOffset <= DAY_SPAN; dayOffset++) {
    // Today is seeded as an explicit, hand-placed fixture instead — see
    // `seed.ts` — so that the day view has something deterministic to assert
    // against rather than whatever this run of the PRNG happened to produce.
    if (dayOffset === 0) {
      continue
    }

    const day = today + dayOffset
    // `Date.UTC` normalises an out-of-range day across month and year
    // boundaries, and reading it back through a `Date` is what turns that
    // normalised value into the real weekday for this calendar day.
    const weekday = new Date(Date.UTC(year, month, day)).getUTCDay()

    for (const barberId of barberIds) {
      appointments.push(
        ...appointmentsForBarberOnDay({
          shopId,
          shopTimezone,
          barberId,
          services,
          customerIds,
          year,
          month,
          day,
          weekday,
          dayOffset,
        }),
      )
    }
  }

  return appointments
}
