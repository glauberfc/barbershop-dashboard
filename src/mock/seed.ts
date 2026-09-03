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
 * The Accounts that exist from the outset. Two, because ticket #5 needs one
 * Account holding Memberships at two Shops and one holding a single
 * Membership, and because a test that signs in has to be able to name an
 * Account that is not the only one in the store.
 */
export const seedAccounts = [
  { id: 'account-ana', email: 'ana@thefaderoom.test', password: 'fade-room-owner' },
  { id: 'account-bruno', email: 'bruno@northlane.test', password: 'north-lane-barber' },
] as const

/**
 * The token that names an Account's session.
 *
 * A real backend mints a random token at sign-in and stores it. This store
 * lives in the page and is rebuilt from nothing on every load, so a minted
 * token would be orphaned by the first reload and would sign the Account
 * straight back out — the one thing ticket #3 says must not happen. Deriving
 * the token from the seed is what lets a reload find the session again without
 * the application holding on to anything itself.
 *
 * The cost is a guessable token, which is not worth defending in a fixture
 * whose passwords are written a few lines above it.
 */
export function sessionTokenFor(accountId: string): string {
  return `session-${accountId}`
}

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

  for (const account of seedAccounts) {
    db.account.create(account)
    db.session.create({ token: sessionTokenFor(account.id), accountId: account.id })
  }
}
