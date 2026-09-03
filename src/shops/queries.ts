import { queryOptions } from '@tanstack/react-query'

import { apiGet } from '@/api/http'
import { shopSchema } from '@/contract/shop'

/**
 * Every Shop-scoped query key begins with the Shop, so a cached response can
 * never be served to a different tenant.
 */
export function shopQueryOptions(shopId: string) {
  return queryOptions({
    queryKey: [shopId, 'shop'] as const,
    // Encoded: a Shop identifier comes from the address bar, and an
    // unencoded `/` would resolve away the `/api/shops/` prefix entirely.
    queryFn: () => apiGet(`/api/shops/${encodeURIComponent(shopId)}`, shopSchema),
  })
}
