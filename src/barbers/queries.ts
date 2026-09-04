import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiGet } from '@/api/http'
import { barberSchema } from '@/contract/barber'

export function barbersQueryOptions(shopId: string) {
  return queryOptions({
    queryKey: [shopId, 'barbers'] as const,
    queryFn: () => apiGet(`/api/shops/${encodeURIComponent(shopId)}/barbers`, z.array(barberSchema)),
  })
}
