import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './http'

/**
 * One QueryClient policy, built the same way for the browser and for tests, so
 * that a test cannot pass on a cache that behaves unlike the real one.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A 4xx will not become a 2xx by asking again, and retrying one buys
        // the reader several seconds of "Loading…" before the error they were
        // always going to get.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 3,
      },
    },
  })
}
