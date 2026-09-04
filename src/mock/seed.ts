import { drop } from '@mswjs/data'

import type { AppointmentStatus } from '@/contract/appointment'
import { db } from './db'
import { generateAppointments, instantAt, todayInShopTimezone } from './generate-appointments'

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
 * The Accounts that exist from the outset. Two, because a test that signs in
 * has to be able to name an Account that is not the only one in the store, and
 * because the Memberships below need one holding several and one holding a
 * single one.
 */
export const seedAccounts = [
  { id: 'account-ana', email: 'ana@thefaderoom.test', password: 'fade-room-owner' },
  { id: 'account-bruno', email: 'bruno@northlane.test', password: 'north-lane-barber' },
] as const

/**
 * The tenant boundary's fixture. Ana is an Owner holding a Membership in both
 * Shops, which is what makes the Shop switcher testable at all. Bruno holds
 * exactly one, at North Lane only — the Fade Room does not exist to him, which
 * is what proves the boundary denies rather than merely not offering a link to
 * cross it.
 */
export const seedMemberships = [
  { id: 'membership-ana-the-fade-room', accountId: 'account-ana', shopId: 'the-fade-room', role: 'owner' },
  {
    id: 'membership-ana-north-lane-barbers',
    accountId: 'account-ana',
    shopId: 'north-lane-barbers',
    role: 'owner',
  },
  {
    id: 'membership-bruno-north-lane-barbers',
    accountId: 'account-bruno',
    shopId: 'north-lane-barbers',
    role: 'barber',
  },
] as const

/**
 * Three Barbers, per the seed spine in ticket #1: two at the Fade Room, so its
 * day view has more than one column to group by, and one at North Lane, named
 * for the Account holding the Barber Membership there so the fixture reads as
 * one coherent shop rather than unrelated rows.
 */
export const seedBarbers = [
  { id: 'barber-marco', shopId: 'the-fade-room', name: 'Marco Dias' },
  { id: 'barber-sofia', shopId: 'the-fade-room', name: 'Sofia Teixeira' },
  { id: 'barber-bruno', shopId: 'north-lane-barbers', name: 'Bruno Rocha' },
] as const

/** Roughly six Services, per ticket #1's seed spine — three at each Shop. */
export const seedServices = [
  { id: 'service-haircut', shopId: 'the-fade-room', name: 'Haircut', durationMinutes: 30 },
  { id: 'service-beard-trim', shopId: 'the-fade-room', name: 'Beard Trim', durationMinutes: 20 },
  { id: 'service-haircut-and-beard', shopId: 'the-fade-room', name: 'Haircut & Beard', durationMinutes: 45 },
  { id: 'service-skin-fade', shopId: 'north-lane-barbers', name: 'Skin Fade', durationMinutes: 30 },
  { id: 'service-hot-towel-shave', shopId: 'north-lane-barbers', name: 'Hot Towel Shave', durationMinutes: 30 },
  { id: 'service-kids-cut', shopId: 'north-lane-barbers', name: 'Kids Cut', durationMinutes: 20 },
] as const

/**
 * A handful of named Customers, referenced by the hand-placed "today"
 * Appointments below so a test can assert on a known name rather than
 * whichever generated Customer the PRNG happened to pick.
 */
export const seedFixtureCustomers = [
  { id: 'customer-marta-silva', shopId: 'the-fade-room', name: 'Marta Silva', phone: '+351 912 345 001', email: null },
  { id: 'customer-tiago-alves', shopId: 'the-fade-room', name: 'Tiago Alves', phone: '+351 912 345 002', email: null },
  {
    id: 'customer-beatriz-costa',
    shopId: 'the-fade-room',
    name: 'Beatriz Costa',
    phone: '+351 912 345 003',
    email: 'beatriz.costa@example.test',
  },
  { id: 'customer-rui-pereira', shopId: 'the-fade-room', name: 'Rui Pereira', phone: '+351 912 345 004', email: null },
  {
    id: 'customer-ines-ferreira',
    shopId: 'north-lane-barbers',
    name: 'Inês Ferreira',
    phone: '+351 913 456 001',
    email: null,
  },
  {
    id: 'customer-pedro-santos',
    shopId: 'north-lane-barbers',
    name: 'Pedro Santos',
    phone: '+351 913 456 002',
    email: 'pedro.santos@example.test',
  },
] as const

const CUSTOMER_FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Diogo', 'Filipa', 'Hugo', 'Joana', 'Luís',
  'Mariana', 'Nuno', 'Paula', 'Ricardo', 'Sara', 'Vasco', 'Catarina', 'André',
] as const

const CUSTOMER_LAST_NAMES = [
  'Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins',
] as const

/**
 * The name as an email local part can use it: the display name keeps its
 * accents, but `luís@…` is not a valid address, so the slug drops them rather
 * than the generator quietly emitting an email `customerSchema` would refuse
 * to parse.
 */
function emailSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * The volume behind the fixture Customers above: enough that browsing and
 * searching the Shop's Customers, and picking one while booking, has more
 * than a handful of rows to work with. Deterministic — built from the index
 * alone, not from a random source — so the same Shop shows the same list on
 * every run.
 */
function generateCustomers(
  shopId: string,
  count: number,
): Array<{ id: string; shopId: string; name: string; phone: string; email: string | null }> {
  return Array.from({ length: count }, (_, index) => {
    const firstName = CUSTOMER_FIRST_NAMES[index % CUSTOMER_FIRST_NAMES.length]!
    const lastName = CUSTOMER_LAST_NAMES[(index * 5 + 3) % CUSTOMER_LAST_NAMES.length]!
    const phoneNumber = 200000 + index * 37

    return {
      id: `customer-${shopId}-${index}`,
      shopId,
      name: `${firstName} ${lastName}`,
      phone: `+351 91${String(phoneNumber).padStart(6, '0')}`,
      email: index % 3 === 0 ? `${emailSlug(firstName)}.${emailSlug(lastName)}.${index}@example.test` : null,
    }
  })
}

interface FixtureAppointment {
  id: string
  shopId: string
  barberId: string
  customerId: string
  serviceId: string
  shopTimezone: string
  hour: number
  minute: number
  status: AppointmentStatus
}

/**
 * Today's Appointments, placed by hand rather than generated, so the day view
 * — the page an Account sees first — has known names, services and times to
 * assert on. One is Cancelled, so "Cancelled Appointments are visually
 * distinct" has a fixture to be true of on the very first day anyone looks at.
 */
const fixtureAppointments: readonly FixtureAppointment[] = [
  {
    id: 'appointment-fixture-marco-1',
    shopId: 'the-fade-room',
    barberId: 'barber-marco',
    customerId: 'customer-marta-silva',
    serviceId: 'service-haircut',
    shopTimezone: 'Europe/Lisbon',
    hour: 9,
    minute: 0,
    status: 'scheduled',
  },
  {
    id: 'appointment-fixture-marco-2',
    shopId: 'the-fade-room',
    barberId: 'barber-marco',
    customerId: 'customer-tiago-alves',
    serviceId: 'service-beard-trim',
    shopTimezone: 'Europe/Lisbon',
    hour: 9,
    minute: 45,
    status: 'scheduled',
  },
  {
    id: 'appointment-fixture-marco-3',
    shopId: 'the-fade-room',
    barberId: 'barber-marco',
    customerId: 'customer-beatriz-costa',
    serviceId: 'service-haircut-and-beard',
    shopTimezone: 'Europe/Lisbon',
    hour: 11,
    minute: 0,
    status: 'cancelled',
  },
  {
    id: 'appointment-fixture-sofia-1',
    shopId: 'the-fade-room',
    barberId: 'barber-sofia',
    customerId: 'customer-rui-pereira',
    serviceId: 'service-haircut',
    shopTimezone: 'Europe/Lisbon',
    hour: 10,
    minute: 0,
    status: 'scheduled',
  },
  {
    id: 'appointment-fixture-bruno-1',
    shopId: 'north-lane-barbers',
    barberId: 'barber-bruno',
    customerId: 'customer-ines-ferreira',
    serviceId: 'service-skin-fade',
    shopTimezone: 'Europe/Lisbon',
    hour: 9,
    minute: 0,
    status: 'scheduled',
  },
  {
    id: 'appointment-fixture-bruno-2',
    shopId: 'north-lane-barbers',
    barberId: 'barber-bruno',
    customerId: 'customer-pedro-santos',
    serviceId: 'service-kids-cut',
    shopTimezone: 'Europe/Lisbon',
    hour: 14,
    minute: 0,
    status: 'scheduled',
  },
]

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

  for (const membership of seedMemberships) {
    db.membership.create(membership)
  }

  for (const barber of seedBarbers) {
    db.barber.create(barber)
  }

  for (const service of seedServices) {
    db.service.create(service)
  }

  for (const customer of seedFixtureCustomers) {
    db.customer.create(customer)
  }

  for (const shop of seedShops) {
    for (const customer of generateCustomers(shop.id, 24)) {
      db.customer.create(customer)
    }
  }

  for (const fixture of fixtureAppointments) {
    const { year, month, day } = todayInShopTimezone(fixture.shopTimezone)
    const start = instantAt(fixture.shopTimezone, year, month, day, fixture.hour * 60 + fixture.minute)

    db.appointment.create({
      id: fixture.id,
      shopId: fixture.shopId,
      barberId: fixture.barberId,
      customerId: fixture.customerId,
      serviceId: fixture.serviceId,
      start: start.toISOString(),
      status: fixture.status,
    })
  }

  for (const shop of seedShops) {
    const barberIds = seedBarbers.filter((barber) => barber.shopId === shop.id).map((barber) => barber.id)
    const services = seedServices.filter((service) => service.shopId === shop.id)
    const customerIds = db.customer
      .findMany({ where: { shopId: { equals: shop.id } } })
      .map((customer) => customer.id)

    const appointments = generateAppointments({
      shopId: shop.id,
      shopTimezone: shop.timezone,
      barberIds,
      services,
      customerIds,
    })

    for (const appointment of appointments) {
      db.appointment.create(appointment)
    }
  }
}
