import { createFileRoute, notFound } from '@tanstack/react-router'

import { sessionQueryOptions } from '@/session/queries'
import { hasMembership } from '@/tenancy/memberships'

/**
 * The tenant boundary. Pathless in effect — every route nested under a Shop is
 * protected by sitting here, the same way every route under `_authenticated`
 * is protected by sitting there, so a page added later cannot forget to check.
 *
 * `notFound()` rather than a message of its own: a Shop this Account holds no
 * Membership in must look exactly like a Shop that does not exist, or the
 * difference between the two responses would be the leak. The mock's
 * `GET /api/shops/:shopId` handler enforces the same rule independently, since
 * a guard that only lived here would be a check the interface remembers to
 * make rather than one the data enforces — this route exists so that check is
 * never even asked for, not so it is the only thing making it.
 */
export const Route = createFileRoute('/_authenticated/shops/$shopId')({
  beforeLoad: async ({ context, params }) => {
    // The outer `_authenticated` guard has already turned away a session it
    // could not read, so this is always an Account by the time it is checked
    // here — and already in the cache, so this costs nothing further.
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions())

    if (!session || !hasMembership(session, params.shopId)) {
      throw notFound()
    }
  },
  notFoundComponent: ShopNotFound,
})

function ShopNotFound() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <p>Could not load this Shop.</p>
    </main>
  )
}
