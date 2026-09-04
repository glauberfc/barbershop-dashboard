import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mock/server'
import { seedAccounts } from '@/mock/seed'
import { renderApp } from '@/test/render-app'
import { signInOverTheApi, signInThroughTheForm } from '@/test/sign-in'

const [account] = seedAccounts

/** The address of a protected route, and the heading only it renders. */
const protectedPath = '/shops/the-fade-room'
const protectedHeading = 'The Fade Room'

/**
 * Records the paths the application asks the API for, so that a test can assert
 * on what it never asked for. A request for a Shop is the sharpest evidence
 * there is that the protected component rendered: nothing else in the tree
 * makes one.
 */
function recordRequests() {
  const paths: string[] = []

  server.events.on('request:start', ({ request }) => {
    paths.push(`${request.method} ${new URL(request.url).pathname}`)
  })

  return paths
}

/**
 * Watches every mutation of the document for a fragment of protected content.
 * Asserting on the final screen cannot catch a flash — by the time the login
 * form is on screen, a frame that showed the Shop has already been thrown away.
 *
 * The mutations themselves are read, not the document they left behind: a node
 * added and removed again before the observer is called back would be gone from
 * the document by the time this looked at it, and that is exactly the case
 * worth catching.
 */
function watchForFlashOf(text: string) {
  const flashes: string[] = []

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const written = [...record.addedNodes, ...(record.type === 'characterData' ? [record.target] : [])]

      for (const node of written) {
        if (node.textContent?.includes(text)) {
          flashes.push(node.textContent)
        }
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  return {
    get flashes() {
      return flashes
    },
    stop: () => observer.disconnect(),
  }
}

/**
 * The destination the login route accepted, which is not the same thing as the
 * one the address asked for — the point of validating it is that they differ.
 */
function acceptedDestination(router: ReturnType<typeof renderApp>['router']) {
  const login = router.state.matches.find((match) => match.routeId === '/login')

  return (login?.search as { redirect?: string } | undefined)?.redirect
}

describe('protected routes', () => {
  it('sends a signed-out Account asking for a protected route to login', async () => {
    const { router } = renderApp(protectedPath)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('carries the originally requested location to login', async () => {
    const { router } = renderApp(protectedPath)

    await screen.findByRole('heading', { name: 'Sign in' })

    expect(router.state.location.search).toEqual({ redirect: protectedPath })
  })

  it('lands on the originally requested route after signing in', async () => {
    const { router } = renderApp(protectedPath)

    await screen.findByRole('heading', { name: 'Sign in' })
    await signInThroughTheForm(account.email, account.password)

    expect(await screen.findByRole('heading', { name: protectedHeading })).toBeVisible()
    expect(router.state.location.pathname).toBe(protectedPath)
  })

  it('lands somewhere sensible when signing in with no intended destination', async () => {
    const { router } = renderApp('/login')

    await signInThroughTheForm(account.email, account.password)

    expect(await screen.findByRole('heading', { name: protectedHeading })).toBeVisible()
    expect(router.state.location.pathname).not.toBe('/login')
  })

  it('never paints protected content before redirecting', async () => {
    const requested = recordRequests()
    const watcher = watchForFlashOf(protectedHeading)
    // Watched by the same means, so that an observer seeing nothing because it
    // was watching nothing cannot pass for protected content never appearing.
    const control = watchForFlashOf('Sign in')

    renderApp(protectedPath)
    await screen.findByRole('heading', { name: 'Sign in' })
    watcher.stop()
    control.stop()

    expect(control.flashes).not.toEqual([])
    expect(watcher.flashes).toEqual([])
    // The guard turned the match away before the component that reads the Shop
    // was ever created, so the Shop was never asked for either.
    expect(requested).not.toContain(`GET /api/shops/the-fade-room`)
  })

  it('lets a signed-in Account through to the protected route', async () => {
    await signInOverTheApi(account)

    renderApp(protectedPath)

    expect(await screen.findByRole('heading', { name: protectedHeading })).toBeVisible()
  })

  it('reads the session from the query cache rather than asking again', async () => {
    renderApp(protectedPath)
    await screen.findByRole('heading', { name: 'Sign in' })

    // From here the session is known: signing in writes the answer the API just
    // gave into the cache. A guard that read the session itself would show up
    // as another GET on the way to the protected route.
    const requested = recordRequests()
    await signInThroughTheForm(account.email, account.password)
    await screen.findByRole('heading', { name: protectedHeading })

    expect(requested).not.toContain('GET /api/session')
  })

  it('neither lets anyone through nor claims they are signed out when it cannot tell', async () => {
    // A refusal that is not a 401 means neither "signed out" nor "ask again",
    // and the guard has to keep it apart from both: the login form would tell
    // an Account it is signed out on no evidence, and the Shop would be
    // protected content shown without a check.
    let readable = false
    server.use(
      http.get('/api/session', () =>
        readable
          ? HttpResponse.json({ account: { id: account.id, email: account.email } })
          : new HttpResponse(null, { status: 403 }),
      ),
    )

    const { router } = renderApp(protectedPath)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check who is signed in.')
    expect(screen.queryByRole('heading', { name: protectedHeading })).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(protectedPath)

    // Asking again is all it takes: the guard re-reads the session and, this
    // time answered, lets the Account through to where it was going.
    readable = true
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: protectedHeading })).toBeVisible()
  })

  it('refuses an intended destination that is not on this site', async () => {
    // The address bar is writable by anyone who can get someone to click a
    // link, so an off-site destination is an open redirect: phishing wearing
    // our own domain, entered through our own login form.
    const offSite = renderApp('/login?redirect=https%3A%2F%2Fevil.test%2F')

    await screen.findByRole('heading', { name: 'Sign in' })

    // The refusal is asserted where it happens rather than by where signing in
    // lands, because today the fallback destination and the Shop are the same
    // place — landing there would prove nothing, and would go on proving
    // nothing after ticket #5 changes what the fallback resolves to.
    expect(acceptedDestination(offSite.router)).toBeUndefined()

    await signInThroughTheForm(account.email, account.password)

    expect(await screen.findByRole('heading', { name: protectedHeading })).toBeVisible()
    expect(offSite.router.state.location.pathname).toBe(protectedPath)

    offSite.unmount()

    // The same attack spelled protocol-relatively, which is a path by the
    // letter of "starts with a slash" and another origin in practice.
    const protocolRelative = renderApp('/login?redirect=%2F%2Fevil.test%2F')

    await screen.findByRole('heading', { name: 'Sign in' })

    expect(acceptedDestination(protocolRelative.router)).toBeUndefined()
  })

  it('accepts a destination within this site, so the refusal above means something', async () => {
    const { router } = renderApp(protectedPath)

    await screen.findByRole('heading', { name: 'Sign in' })

    expect(acceptedDestination(router)).toBe(protectedPath)
  })
})
