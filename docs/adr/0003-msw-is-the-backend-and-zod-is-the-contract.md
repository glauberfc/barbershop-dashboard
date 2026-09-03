# MSW is the backend, and Zod schemas are the contract

There is no server and no ORM in this repository. The API is a set of MSW
handlers over an `@mswjs/data` store, seeded fresh on each load. Drizzle over
in-browser PGlite was considered and rejected as writing a database schema for
a database that does not exist yet; TanStack Start with a real Postgres was
considered and rejected as premature for a UI-first phase.

That trade has a cost: without a shared schema, nothing structural connects
this mock to the real backend that will replace it. Zod schemas are what we
created to fill that gap. They are the single source of truth — TypeScript
types are inferred from them, handlers parse requests with them, the query
layer parses responses with them, and forms validate against them.

## Consequences

- The real backend will be built to satisfy these schemas. On the day MSW is
  deleted, `parse()` at the boundary reports precisely where the real server
  disagrees with what the UI was built against.
- Business logic must not live inside handlers. Anything real — slot
  computation above all — belongs in pure functions the handlers merely call,
  so that deleting MSW deletes only an HTTP adapter.
- The mock cannot reproduce concurrency. "Two customers booked the same slot"
  is a bug class that will only ever appear against the real server, which is
  why the create endpoint returns 409 even though the slot picker should make
  it unreachable.
