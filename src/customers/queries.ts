import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiGet } from '@/api/http'
import { customerSchema } from '@/contract/customer'

/**
 * The Shop's Customers. Read-only for now — ticket #7 adds searching and
 * creating one. Used here only to join a name onto an Appointment; the day
 * view has no Customers UI of its own.
 */
export function customersQueryOptions(shopId: string) {
  return queryOptions({
    queryKey: [shopId, 'customers'] as const,
    queryFn: () => apiGet(`/api/shops/${encodeURIComponent(shopId)}/customers`, z.array(customerSchema)),
  })
}
