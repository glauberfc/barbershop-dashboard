import { drop } from '@mswjs/data'

import { db } from './db'

/**
 * The fixed spine of the seed: named entities with stable identifiers, so that
 * a developer can reach a known Shop by typing its address and a test can
 * assert on a known name. Two Shops exist from the outset because the tenant
 * boundary and the Shop switcher are only meaningful with more than one.
 */
export const seedShops = [
  { id: 'the-fade-room', name: 'The Fade Room', timezone: 'Europe/Lisbon' },
  { id: 'north-lane-barbers', name: 'North Lane Barbers', timezone: 'Europe/Lisbon' },
] as const

/**
 * Empties the store and reseeds it. Deterministic: the same call always
 * produces the same records, so a reload never changes what is on screen and a
 * test never depends on what ran before it.
 */
export function seedDb(): void {
  drop(db)

  for (const shop of seedShops) {
    db.shop.create(shop)
  }
}
