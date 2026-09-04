import { createFileRoute, Link } from '@tanstack/react-router'

import { CustomersPage } from '@/customers/customers-page'

export const Route = createFileRoute('/_authenticated/shops/$shopId/customers')({
  component: RouteComponent,
})

function RouteComponent() {
  const { shopId } = Route.useParams()

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <Link to="/shops/$shopId" params={{ shopId }} className="self-start text-sm underline underline-offset-4">
        Back to the day
      </Link>

      <CustomersPage shopId={shopId} />
    </main>
  )
}
