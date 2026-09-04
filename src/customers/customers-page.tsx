import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCustomerSchema } from '@/contract/customer'
import { customersQueryOptions, useCreateCustomer } from './queries'

/**
 * Browsing, searching and adding this Shop's Customers, per ticket #7. A
 * Customer is never shared between Shops, per ADR-0001 — this page reads and
 * writes only the one named in `shopId`, the same tenant boundary every other
 * Shop-scoped page sits behind.
 */
export function CustomersPage({ shopId }: { shopId: string }) {
  const [search, setSearch] = useState('')
  const customers = useQuery(customersQueryOptions(shopId, search))

  return (
    <div className="flex flex-col gap-6">
      <AddCustomerForm shopId={shopId} onAdded={() => setSearch('')} />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Customers</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="customer-search">Search by name</Label>
            <Input
              id="customer-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Customers…"
            />
          </div>

          {customers.status === 'pending' ? <p>Loading Customers…</p> : null}

          {customers.status === 'error' ? (
            <div className="flex flex-col items-start gap-2">
              <p role="alert">Could not load Customers.</p>
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => customers.refetch()}
              >
                Try again
              </button>
            </div>
          ) : null}

          {customers.status === 'success' && customers.data.length === 0 ? (
            <p>{search ? `No Customers match “${search}”.` : 'This Shop has no Customers yet.'}</p>
          ) : null}

          {customers.status === 'success' && customers.data.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {customers.data.map((customer) => (
                <li key={customer.id} className="flex flex-col border-b pb-3 last:border-0 last:pb-0">
                  <span className="font-medium">{customer.name}</span>
                  <span className="text-sm text-muted-foreground">{customer.phone}</span>
                  {customer.email ? (
                    <span className="text-sm text-muted-foreground">{customer.email}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

type FieldErrors = Partial<Record<'name' | 'phone' | 'email', string[]>>

function AddCustomerForm({ shopId, onAdded }: { shopId: string; onAdded: () => void }) {
  const createCustomer = useCreateCustomer(shopId)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const data = new FormData(form)
    const input = createCustomerSchema.safeParse({
      name: data.get('name'),
      phone: data.get('phone'),
      email: data.get('email'),
    })

    if (!input.success) {
      setFieldErrors(z.flattenError(input.error).fieldErrors)
      createCustomer.reset()
      return
    }

    setFieldErrors({})
    createCustomer.mutate(input.data, {
      onSuccess: () => {
        form.reset()
        onAdded()
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Add a Customer</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <Field name="name" label="Name" errors={fieldErrors.name} />
          <Field name="phone" label="Phone" type="tel" errors={fieldErrors.phone} />
          <Field name="email" label="Email (optional)" type="email" errors={fieldErrors.email} />

          {createCustomer.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Could not add this Customer. Please try again.
            </p>
          ) : null}

          <Button type="submit" disabled={createCustomer.isPending} className="self-start">
            {createCustomer.isPending ? 'Adding…' : 'Add Customer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Field({
  name,
  label,
  errors,
  ...input
}: React.ComponentProps<typeof Input> & { name: string; label: string; errors?: string[] }) {
  const errorId = `${name}-error`

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
        {...input}
      />
      {errors ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors.join(' ')}
        </p>
      ) : null}
    </div>
  )
}
