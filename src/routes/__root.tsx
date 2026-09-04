import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet, useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { sessionQueryOptions, useSignOut } from '@/session/queries'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <SessionBar />
      <Outlet />
    </div>
  )
}

/**
 * The only place the interface says who is signed in. It reads the session
 * through the query layer like any other server state — there is no provider
 * above it holding a second copy — and shows nothing at all until there is a
 * session to show, which keeps it out of the way on the login route.
 */
function SessionBar() {
  const navigate = useNavigate()
  const session = useQuery(sessionQueryOptions())
  const signOut = useSignOut()

  // Three states, not two. The query layer keeps "nobody is signed in" apart
  // from "the API could not be asked", and collapsing them here would throw
  // that away: a signed-in Account would silently lose its sign-out control and
  // be shown a page that looks exactly like being signed out.
  if (session.isError) {
    return (
      <header className="flex items-center justify-end border-b px-8 py-3">
        <p role="alert" className="text-sm text-destructive">
          Could not check who is signed in.
        </p>
      </header>
    )
  }

  if (!session.data) {
    return null
  }

  return (
    <header className="flex items-center justify-end gap-4 border-b px-8 py-3">
      <p className="text-sm text-muted-foreground">Signed in as {session.data.account.email}</p>
      {signOut.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not sign out. Please try again.
        </p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) })}
      >
        {signOut.isPending ? 'Signing out…' : 'Sign out'}
      </Button>
    </header>
  )
}
