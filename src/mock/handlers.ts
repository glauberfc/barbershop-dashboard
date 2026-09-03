import { http, HttpResponse } from 'msw'

import { shopSchema } from '@/contract/shop'
import { db } from './db'

/**
 * The mock API. This array is exported once and mounted twice — by the browser
 * worker in development and by `setupServer` in tests — so the two can never
 * drift. Per ADR-0003 handlers hold no business logic: they read the store,
 * call domain functions, and serialise through the contract schemas.
 */
export const handlers = [
  http.get('/api/shops/:shopId', ({ params }) => {
    const shop = db.shop.findFirst({
      where: { id: { equals: String(params.shopId) } },
    })

    // Not found rather than forbidden: a forbidden response would confirm the
    // Shop exists, leaking one tenant's existence to another.
    if (!shop) {
      return new HttpResponse(null, { status: 404 })
    }

    return HttpResponse.json(shopSchema.parse(shop))
  }),
]
