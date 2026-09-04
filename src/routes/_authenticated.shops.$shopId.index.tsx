import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { todayInShop } from '@/scheduling/day-range'
import { DayView } from '@/scheduling/day-view'
import { shopQueryOptions } from '@/shops/queries'
import { sessionQueryOptions } from '@/session/queries'
import { ShopSwitcher } from '@/tenancy/shop-switcher'

export const Route = createFileRoute('/_authenticated/shops/$shopId/')({
  // A plain calendar date (`yyyy-MM-dd`), not a default: the Shop's own
  // timezone is what "today" means here, per ADR-0002, and that is not known
  // until the Shop itself has loaded — so absence is resolved by the day view
  // once it knows which Shop it is showing, not by this schema.
  validateSearch: z.object({ date: z.iso.date().optional() }),
  component: ShopPage,
})

function ShopPage() {
  const { shopId } = Route.useParams()
  const { date } = Route.useSearch()
  const navigate = Route.useNavigate()
  const shop = useQuery(shopQueryOptions(shopId))
  // Already in the cache: the tenant guard this route sits beneath just read
  // it to let this Shop through. `refetchOnMount` is turned off because this
  // component mounts fresh on every navigation into a Shop, and the default
  // would otherwise repeat a read the guard made an instant ago — the guard
  // reading from the cache rather than asking again would stop being true.
  const session = useQuery({ ...sessionQueryOptions(), refetchOnMount: false })

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      {session.data ? <ShopSwitcher session={session.data} currentShopId={shopId} /> : null}

      <Link
        to="/shops/$shopId/customers"
        params={{ shopId }}
        className="self-start text-sm underline underline-offset-4"
      >
        Customers
      </Link>

      {shop.status === 'pending' ? <p>Loading the Shop…</p> : null}

      {shop.status === 'error' ? (
        <div className="flex flex-col items-start gap-2">
          <p>Could not load this Shop.</p>
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => shop.refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {shop.status === 'success' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <h1>{shop.data.name}</h1>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">All times shown in {shop.data.timezone}.</p>
            </CardContent>
          </Card>

          <DayView
            shopId={shopId}
            shopTimezone={shop.data.timezone}
            date={date ?? todayInShop(shop.data.timezone)}
            onNavigate={(nextDate) => navigate({ search: (prev) => ({ ...prev, date: nextDate }) })}
          />
        </>
      ) : null}
    </main>
  )
}
