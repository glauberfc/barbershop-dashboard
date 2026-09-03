import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { StrictMode } from 'react'

import { createQueryClient } from '@/api/query-client'
import { createAppRouter } from '@/router'

/**
 * Renders the real application at a given address: the real router, the real
 * route tree, the same QueryClient policy and the same StrictMode as
 * `main.tsx`. Only the address and the network transport differ, so a test
 * asserts on what a Barber would see.
 */
export function renderApp(initialPath: string) {
  const queryClient = createQueryClient()

  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })

  const result = render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )

  return { ...result, router, queryClient }
}
