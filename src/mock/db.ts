import { factory, nullable, primaryKey } from '@mswjs/data'

/**
 * The mock API's store. Per ADR-0003 there is no database and no ORM — this
 * in-memory store is what the handlers read and write, and it is reseeded on
 * every load. Models are added here as each slice needs them.
 */
export const db = factory({
  shop: {
    id: primaryKey(String),
    name: String,
    timezone: String,
  },
  account: {
    id: primaryKey(String),
    email: String,
    // Stored in the clear because this store is a fixture, not a database. The
    // real backend will hash; nothing here should be read as a suggestion that
    // it should not. No contract schema names this field, so it cannot be
    // serialised out of the mock — see src/contract/session.ts.
    password: String,
  },
  // A session is a row, not a claim inside a token: signing out deletes it,
  // and the cookie the browser holds is an opaque key to it and nothing more.
  session: {
    token: primaryKey(String),
    accountId: String,
  },
  // The tenant boundary. An Account with no row here for a Shop holds no
  // Membership in it, and per the contract that Shop does not exist to them.
  membership: {
    id: primaryKey(String),
    accountId: String,
    shopId: String,
    role: String,
  },
  barber: {
    id: primaryKey(String),
    shopId: String,
    name: String,
  },
  service: {
    id: primaryKey(String),
    shopId: String,
    name: String,
    durationMinutes: Number,
  },
  // Scoped to one Shop and never shared, per ADR-0001 — there is no field
  // linking a Customer row to another Shop's, by design.
  customer: {
    id: primaryKey(String),
    shopId: String,
    name: String,
    phone: String,
    // Absent rather than empty: the handler maps `null` to an omitted field,
    // so `customerSchema`'s `.optional()` and the store's column agree about
    // what "no email on file" means.
    email: nullable(String),
  },
  appointment: {
    id: primaryKey(String),
    shopId: String,
    barberId: String,
    customerId: String,
    serviceId: String,
    // Stored as an ISO string rather than a `Date`: this is the value that
    // crosses the wire unchanged, and keeping the store's shape the same as
    // the contract's is what lets the handler serialise it with a plain spread
    // rather than a conversion that could disagree with `appointmentSchema`.
    start: String,
    status: String,
  },
})
