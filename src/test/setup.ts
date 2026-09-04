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

/**
 * Each test starts as a fresh browser would: an empty cookie jar and a freshly
 * seeded store.
 *
 * Emptying the jar has to go through the API. MSW keeps response cookies in a
 * store of its own, built once from `localStorage` and never rebuilt, so
 * clearing `document.cookie` leaves the session behind and the next test starts
 * signed in as whoever the last one was. The only thing that removes a cookie
 * from that store is a response expiring it, which is precisely what signing
 * out does.
 */
beforeEach(async () => {
  await fetch(new URL('/api/session', window.location.origin), {
    method: 'DELETE',
    credentials: 'include',
  })

  seedDb()
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Listeners a test attached to watch traffic, dropped with the handlers it
  // overrode, so that one test cannot observe the next one's requests.
  server.events.removeAllListeners()
})

afterAll(() => server.close())
