import { hashKey, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiDelete, apiGet, apiPost } from '@/api/http'
import { type Credentials, type Session, sessionSchema } from '@/contract/session'

/**
 * Signing in, signing out, and reading who is signed in. Everything the
 * application knows about the session passes through this module: no component
 * calls `/api/session`, names the cookie, or holds a credential of its own.
 *
 * The session has exactly one home — this query key in the QueryClient the
 * router already carries. There is deliberately no React context mirroring it,
 * because two homes means two answers and a bug the day they disagree.
 */
export const sessionQueryKey = ['session'] as const

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: sessionQueryKey,
    queryFn: async (): Promise<Session | null> => {
      try {
        return await apiGet('/api/session', sessionSchema)
      } catch (error) {
        // Signed out is an answer, not a failure. Anything else is a failure
        // and is left to propagate, so that "nobody is signed in" is never
        // reported when the truth is "the API could not be reached".
        if (error instanceof ApiError && error.status === 401) {
          return null
        }

        throw error
      }
    },
  })
}

export function useSignIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (credentials: Credentials) => apiPost('/api/session', credentials, sessionSchema),
    onSuccess: async (session) => {
      // A read of the session that left before this sign-in did is still in
      // flight, and it was sent without a cookie: left alone it resolves as a
      // 401, becomes `null`, and signs the Account straight back out a moment
      // after it signed in. Cancelling first is what makes the write below the
      // last word.
      await queryClient.cancelQueries({ queryKey: sessionQueryKey })

      // The response already says who signed in, so writing it into the cache
      // saves a round trip and, more usefully, means the interface is never
      // briefly signed out immediately after signing in.
      queryClient.setQueryData(sessionQueryKey, session)
    },
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiDelete('/api/session'),
    onSuccess: async () => {
      // The mirror of the race above, and the worse of the two: a read that
      // left while the cookie was still valid answers with the Account, lands
      // after the session has been destroyed, and puts the interface back into
      // a signed-in state that no longer exists anywhere.
      await queryClient.cancelQueries()

      // Everything else in the cache was read as the outgoing Account, under
      // Shops the next one may have no access to. The session itself is left in
      // place and overwritten, so the observer watching it does not see an
      // empty cache and immediately refetch on the way to the login route.
      queryClient.removeQueries({
        predicate: (query) => query.queryHash !== hashKey(sessionQueryKey),
      })

      queryClient.setQueryData(sessionQueryKey, null)
    },
  })
}

/**
 * Why signing in failed, in words for the person who tried. Kept here with the
 * rest of the session's knowledge of HTTP so that no component has to reason
 * about a status code to tell a rejection from an outage.
 *
 * Three answers, not two. An `ApiError` means the API replied, so reporting it
 * as a connection problem would send someone to check their network over a
 * defect on our side — a 400 here means the form and the handler have stopped
 * agreeing about `credentialsSchema`, which is the one thing sharing it is
 * meant to make impossible.
 */
export function signInFailureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 401
      ? 'That email and password do not match an Account.'
      : 'Something went wrong signing in. Please try again.'
  }

  return 'Could not reach the API. Check your connection and try again.'
}
