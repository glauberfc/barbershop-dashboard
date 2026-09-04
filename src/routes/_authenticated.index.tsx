import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { sessionQueryOptions } from '@/session/queries'
import { soleShopId } from '@/tenancy/memberships'
import { ShopSwitcher } from '@/tenancy/shop-switcher'

/**
 * Where an Account lands when it asked for nothing in particular. Behind the
 * guard, so a signed-out visitor is sent to login first, carrying `/` as the
 * destination like any other protected route — there is no separate rule here
 * for reaching the root.
 *
 * The read is `ensureQueryData` against the same cache the guard above just
 * populated, so this costs nothing beyond what authentication already paid
 * for.
 */
export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions())

    // The guard above already turned away a session it could not read, so a
    // session reaching here is always an Account, never `null`.
    if (!session) {
      return
    }

    const shopId = soleShopId(session)

    if (shopId) {
      throw redirect({ to: '/shops/$shopId', params: { shopId } })
    }
  },
  component: ChooseShop,
})

/**
 * Shown only to an Account holding several Memberships, or none. One holding
 * exactly one never sees this — `beforeLoad` above has already sent it on.
 */
function ChooseShop() {
  // Read the way any other component does — through the query layer, not the
  // route context — so this stays current if the session ever changes under
  // it. Already in the cache from the guard above, and `refetchOnMount` is off
  // so mounting here does not repeat the read that guard just made.
  const { data: session } = useQuery({ ...sessionQueryOptions(), refetchOnMount: false })

  if (!session || session.memberships.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>This Account holds no Membership in any Shop.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-lg font-semibold">Choose a Shop</h1>
      <ShopSwitcher session={session} />
    </main>
  )
}
