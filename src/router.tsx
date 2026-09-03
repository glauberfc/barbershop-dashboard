import { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

/**
 * The router context carries the QueryClient, so the session and every other
 * shared read has exactly one home. Built by a factory rather than as a module
 * singleton so that each test gets a router and a cache of its own.
 */
export function createAppRouter(options?: {
  queryClient?: QueryClient
  history?: RouterHistory
}) {
  const queryClient = options?.queryClient ?? new QueryClient()

  return createRouter({
    routeTree,
    context: { queryClient },
    history: options?.history,
    defaultPreload: 'intent',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
