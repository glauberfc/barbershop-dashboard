import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Scaffolding, so that a fresh clone lands somewhere real. The address is
 * written out rather than imported from the seed, so that no application code
 * depends on the mock. Ticket #4 replaces this with the authentication guard,
 * and ticket #5 with the Membership lookup that decides which Shop an Account
 * is taken to.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/shops/$shopId', params: { shopId: 'the-fade-room' } })
  },
})
