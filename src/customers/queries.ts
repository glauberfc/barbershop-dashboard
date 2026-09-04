import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { apiGet, apiPost } from '@/api/http'
import { type CreateCustomer, customerSchema } from '@/contract/customer'

/**
 * The Shop's Customers, optionally searched by name. `search` sits in the
 * query key rather than only in the request, so each search term is its own
 * cache entry and switching back to one already seen needs no round trip.
 */
export function customersQueryOptions(shopId: string, search?: string) {
  return queryOptions({
    queryKey: [shopId, 'customers', search ?? ''] as const,
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) {
        params.set('q', search)
      }
      const query = params.toString()

      return apiGet(
        `/api/shops/${encodeURIComponent(shopId)}/customers${query ? `?${query}` : ''}`,
        z.array(customerSchema),
      )
    },
  })
}

/**
 * Adding a Customer. Invalidating every `[shopId, 'customers', …]` query —
 * every search term this Shop has been searched by, not only the current one
 * — is what makes a newly added Customer reachable immediately, without a
 * page reload, however whoever added them gets there next.
 */
export function useCreateCustomer(shopId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateCustomer) =>
      apiPost(`/api/shops/${encodeURIComponent(shopId)}/customers`, input, customerSchema),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [shopId, 'customers'] }),
  })
}
