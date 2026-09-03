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
})
