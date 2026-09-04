import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { shopQueryOptions } from '@/shops/queries'

export const Route = createFileRoute('/_authenticated/shops/$shopId')({
  component: ShopPage,
})

function ShopPage() {
  const { shopId } = Route.useParams()
  const shop = useQuery(shopQueryOptions(shopId))

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
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
