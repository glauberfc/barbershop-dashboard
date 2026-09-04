import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Where an Account lands when it asked for nothing in particular. Scaffolding:
 * the address is written out rather than imported from the seed, so that no
 * application code depends on the mock, and ticket #5 replaces it with the
 * Membership lookup that decides which Shop an Account is actually taken to.
 *
 * Unprotected, and it needs no guard of its own: it holds nothing, and the
 * route it hands over to is behind the guard.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/shops/$shopId', params: { shopId: 'the-fade-room' } })
  },
})
