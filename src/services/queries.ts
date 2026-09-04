import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiGet } from '@/api/http'
import { serviceSchema } from '@/contract/service'

export function servicesQueryOptions(shopId: string) {
  return queryOptions({
    queryKey: [shopId, 'services'] as const,
    queryFn: () => apiGet(`/api/shops/${encodeURIComponent(shopId)}/services`, z.array(serviceSchema)),
  })
}
