import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

import { server } from '@/mock/server'
import { seedDb } from '@/mock/seed'

// Seam 1: only the network transport is intercepted. The same handler array the
// browser mounts runs here, over the same store, seeded the same way.
beforeAll(() => {
  // jsdom does not implement scrolling; the router restores it on navigation.
  window.scrollTo = () => {}
  server.listen({ onUnhandledRequest: 'error' })
})

beforeEach(() => seedDb())

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => server.close())
