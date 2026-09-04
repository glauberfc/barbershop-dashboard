import {
  createFileRoute,
  ErrorComponent,
  type ErrorComponentProps,
  redirect,
  useRouter,
} from '@tanstack/react-router'

import { sessionQueryOptions } from '@/session/queries'

/**
 * The read below failed rather than answered. Wrapped in a type of its own so
 * that the boundary underneath can tell an authentication failure from any
 * other failure that reaches it from a route nested here — a child's error
 * relabelled as "we could not tell who you are" would send whoever is
 * debugging it a long way in the wrong direction.
 */
class SessionUnreadable extends Error {
  constructor(cause: unknown) {
    super('Could not read the session', { cause })
    this.name = 'SessionUnreadable'
  }
}

/**
 * The authentication guard. Pathless — it adds nothing to the address — so a
 * route is protected by where its file sits rather than by remembering to opt
 * in, and the day someone adds a route under here and forgets about
 * authentication entirely, it is still protected.
 *
 * The check lives in `beforeLoad` rather than in a component, because a
 * component that decides whether to render protected content has already been
 * given the protected content to decide about. `beforeLoad` runs while the
 * route is being matched: throwing a redirect here abandons the match, so
 * nothing beneath it is ever created, let alone painted.
 *
 * Deliberately no `component`: the default is an `Outlet`, and a layout that
 * rendered anything of its own would be a place for protected chrome to appear
 * before its children.
 */
export const Route = createFileRoute('/_authenticated')({
  pendingComponent: Checking,
  errorComponent: GuardFailure,
  beforeLoad: async ({ context, location }) => {
    // Read through the QueryClient the router context already carries, not with
    // a request of this route's own. The session has exactly one home, and a
    // guard that fetched separately would be a second answer to who is signed
    // in — and a second round trip on every navigation, on top of the one the
    // interface is already making.
    //
    // The cost is that a cached answer is taken at its word: a session revoked
    // elsewhere is admitted here until something re-reads it — the session bar
    // on the next window focus, or a reload. Making the guard revalidate would
    // buy a request per navigation and still race, and the reads beneath it are
    // what the API actually refuses. That is the trade, made knowingly.
    let session

    try {
      session = await context.queryClient.ensureQueryData(sessionQueryOptions())
    } catch (cause) {
      throw new SessionUnreadable(cause)
    }

    if (!session) {
      // Where the Account was going, so that signing in finishes the journey it
      // interrupted rather than dropping it somewhere default.
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }

    // The session is not returned into the route context. It would be a copy
    // taken at match time, and copies go stale: an Account that signed out in
    // another tab would go on being described as signed in by every route
    // beneath this one. Anything that needs the session reads it from its one
    // home, where it is kept current.
  },
})

/**
 * Shown while the guard is waiting on the session. Without it a slow or
 * retrying read leaves the whole page blank — on a first load there is no
 * previous route for the router to hold on to — and a blank page is
 * indistinguishable from a broken one.
 */
function Checking() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <p>Checking who is signed in…</p>
    </main>
  )
}

/**
 * What stands in for the protected route when the session could not be read.
 * Signed out is an answer and is redirected; this is the third state, where the
 * API could not be asked at all, and it must not be shown as either of the
 * other two. Sending someone to the login form here would tell them they are
 * signed out on no evidence, and letting them through would be worse.
 */
function GuardFailure({ error }: ErrorComponentProps) {
  const router = useRouter()

  if (!(error instanceof SessionUnreadable)) {
    return <ErrorComponent error={error} />
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-2 p-8">
      {/* Not the sentence the session bar is already saying. It says the
          session could not be read; two alerts carrying one message are read
          out twice by a screen reader. This says what that means for the page
          that was asked for. */}
      <p>This page is not shown until we know who is signed in.</p>
      {/* Re-running the match is what retries the read: the guard asks the
          query layer again, and a session that answers this time is let
          through to wherever it was going. */}
      <button
        type="button"
        className="underline underline-offset-4"
        onClick={() => router.invalidate()}
      >
        Try again
      </button>
    </main>
  )
}
