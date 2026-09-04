import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import type { Session } from '@/contract/session'
import { shopQueryOptions } from '@/shops/queries'

/**
 * Every Shop the session's Account can switch to. Shown only when there is a
 * real choice — a single Membership is taken straight to its Shop instead, at
 * `/`, and is never offered a list of one.
 *
 * Each Shop is its own query, keyed by its own id like every other read here,
 * so switching is a navigation to a different address rather than a fetch this
 * component orchestrates itself — the Shop page underneath does the fetching,
 * and this only needs enough of each Shop to label a link.
 */
export function ShopSwitcher({ session, currentShopId }: { session: Session; currentShopId?: string }) {
  const shops = useQueries({
    queries: session.memberships.map((membership) => shopQueryOptions(membership.shopId)),
  })

  if (session.memberships.length < 2) {
    return null
  }

  return (
    <nav aria-label="Switch Shop" className="flex flex-wrap gap-4 text-sm">
      {session.memberships.map((membership, index) => {
        // `useQueries` returns one result per query, in the order given, so
        // this is always present — the two arrays share their length by
        // construction.
        const shop = shops[index]!

        if (shop.status !== 'success') {
          return null
        }

        const isCurrent = membership.shopId === currentShopId

        return (
          <Link
            key={membership.shopId}
            to="/shops/$shopId"
            params={{ shopId: membership.shopId }}
            aria-current={isCurrent ? 'page' : undefined}
            className={isCurrent ? 'font-semibold underline' : 'text-muted-foreground underline'}
          >
            {shop.data.name}
          </Link>
        )
      })}
    </nav>
  )
}
