import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { createQueryClient } from './api/query-client'
import { createAppRouter } from './router'
import './styles.css'

/**
 * Per ADR-0003 the mock is the backend, so it starts before the application
 * renders — there is no window in which a request could escape to the network.
 */
async function startMockApi() {
  const [{ worker }, { seedDb }] = await Promise.all([
    import('./mock/browser'),
    import('./mock/seed'),
  ])

  seedDb()

  await worker.start({
    onUnhandledRequest(request, print) {
      // Anything under /api is the mock's responsibility, and a miss there is a
      // defect rather than something to let through to the real network.
      // Everything else is Vite serving the application's own assets.
      if (new URL(request.url).pathname.startsWith('/api/')) {
        print.error()
      }
    },
  })
}

/**
 * Rendered when the mock cannot start — a service worker blocked by private
 * browsing or an insecure origin, or a worker script that is not where it is
 * expected. Without this the whole application is a blank page and a console
 * message nobody is looking at.
 */
function StartupFailure() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-lg font-medium">The mock API could not start.</h1>
      <p className="text-muted-foreground">
        This application has no backend of its own — see ADR-0003. Check the console, then
        reload.
      </p>
    </main>
  )
}

async function main() {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Missing #root element')
  }

  const root: Root = createRoot(rootElement)

  try {
    await startMockApi()
  } catch (error) {
    console.error('Failed to start the mock API', error)
    root.render(<StartupFailure />)
    return
  }

  const queryClient = createQueryClient()
  const router = createAppRouter({ queryClient })

  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void main()
