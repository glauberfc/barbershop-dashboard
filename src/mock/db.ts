import { factory, primaryKey } from '@mswjs/data'

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
})
