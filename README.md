# Barbershop dashboard

A multi-tenant scheduling platform for barbershops. See `CONTEXT.md` for the
domain language and `docs/adr/` for the decisions that govern the code.

There is no server, no database and no credentials. The API is a set of MSW
handlers over an in-memory `@mswjs/data` store, seeded fresh on every load —
see ADR-0003.

`public/mockServiceWorker.js` is committed and is kept in step with the installed
`msw` version by that package's own postinstall hook, via the `msw.workerDirectory`
field in `package.json`. Don't edit it by hand.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest and Testing Library
npm run typecheck
```

## Layout

| Path            | What lives there                                                       |
| --------------- | ---------------------------------------------------------------------- |
| `src/contract/` | Zod schemas. The single source of truth; types are inferred from these. |
| `src/mock/`     | The mock API: store, seed, handlers, and the two mounts for them.       |
| `src/api/`      | The HTTP boundary, where every response is parsed with its schema.      |
| `src/routes/`   | File-based routes. `routeTree.gen.ts` is generated from this directory. |
| `src/shops/`    | The Shops feature: its query layer and its tests.                       |
| `src/test/`     | Test setup and the Seam 1 render harness.                               |
