import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { shopQueryOptions } from '@/shops/queries'
import { sessionQueryOptions } from '@/session/queries'
import { ShopSwitcher } from '@/tenancy/shop-switcher'

export const Route = createFileRoute('/_authenticated/shops/$shopId/')({
  component: ShopPage,
})

function ShopPage() {
  const { shopId } = Route.useParams()
  const shop = useQuery(shopQueryOptions(shopId))
  // Already in the cache: the tenant guard this route sits beneath just read
  // it to let this Shop through. `refetchOnMount` is turned off because this
  // component mounts fresh on every navigation into a Shop, and the default
  // would otherwise repeat a read the guard made an instant ago — the guard
  // reading from the cache rather than asking again would stop being true.
  const session = useQuery({ ...sessionQueryOptions(), refetchOnMount: false })

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      {session.data ? <ShopSwitcher session={session.data} currentShopId={shopId} /> : null}

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
      ) : null}
    </main>
  )
}
