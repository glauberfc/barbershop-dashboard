import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mock/server'
import { seedAccounts } from '@/mock/seed'
import { renderApp } from '@/test/render-app'
import { signInThroughTheForm as signIn } from '@/test/sign-in'

const [account] = seedAccounts

/**
 * Holds `GET /api/session` open until it is released, so that a test can put a
 * read of the session in flight and decide exactly when it lands. The races
 * below are only reachable while such a read is outstanding, and waiting on a
 * timer to reproduce them would make them pass by luck.
 */
function holdSessionRead(answer: () => Response) {
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })

  server.use(
    http.get('/api/session', async () => {
      await held
      return answer()
    }),
  )

  return async () => {
    release()
    // One macrotask is enough for the held response to resolve and for anything
    // it would have written to the cache to have been written.
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('signing in and out', () => {
  it('signs an Account in and shows that it is signed in', async () => {
    renderApp('/login')

    await signIn(account.email, account.password)

    expect(await screen.findByText(`Signed in as ${account.email}`)).toBeVisible()
  })

  it('reports wrong credentials, distinguishably from a failure to reach the API', async () => {
    renderApp('/login')

    await signIn(account.email, 'not-the-password')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email and password do not match an Account.',
    )
    expect(screen.queryByText(`Signed in as ${account.email}`)).not.toBeInTheDocument()
  })

  it('reports a failure to reach the API in different words', async () => {
    server.use(http.post('/api/session', () => HttpResponse.error()))

    renderApp('/login')

    await signIn(account.email, account.password)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach the API. Check your connection and try again.',
    )
  })

  it('catches invalid input before it reaches the API', async () => {
    const posted: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') {
        posted.push(new URL(request.url).pathname)
      }
    })

    renderApp('/login')

    await signIn('not-an-email', '')

    expect(await screen.findByText('Enter an email address.')).toBeVisible()
    expect(screen.getByText('Enter your password.')).toBeVisible()
    expect(posted).toEqual([])
  })

  it('signs in an Account whose email is typed in a different case', async () => {
    renderApp('/login')

    await signIn(account.email.toUpperCase(), account.password)

    expect(await screen.findByText(`Signed in as ${account.email}`)).toBeVisible()
  })

  it('drops a rejection from the API once the input is what is wrong', async () => {
    const user = userEvent.setup()
    renderApp('/login')

    await signIn(account.email, 'not-the-password')
    expect(await screen.findByRole('alert')).toBeVisible()

    // Nothing is sent this time, so the rejection above no longer describes
    // anything that happened.
    await user.clear(await screen.findByLabelText('Password'))
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter your password.')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('is not signed back out by a session read that was already in flight', async () => {
    // The read the interface makes on mount, sent before any cookie existed and
    // so answered with a 401.
    const landStaleRead = holdSessionRead(() => new HttpResponse(null, { status: 401 }))

    renderApp('/login')
    await signIn(account.email, account.password)
    expect(await screen.findByText(`Signed in as ${account.email}`)).toBeVisible()

    await landStaleRead()

    expect(screen.getByText(`Signed in as ${account.email}`)).toBeVisible()
  })

  it('is not signed back in by a session read that was already in flight', async () => {
    // A read sent while the session was still valid, and so answered with the
    // Account, however long it takes to arrive.
    const landStaleRead = holdSessionRead(() =>
      HttpResponse.json({ account: { id: account.id, email: account.email } }),
    )
    const user = userEvent.setup()

    renderApp('/login')
    await signIn(account.email, account.password)
    await screen.findByText(`Signed in as ${account.email}`)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Sign in' })

    await landStaleRead()

    expect(screen.queryByText(`Signed in as ${account.email}`)).not.toBeInTheDocument()
  })

  it('says so when it cannot tell whether anyone is signed in', async () => {
    // A refusal that is not a 401, so it means neither "signed out" nor "ask
    // again" — the QueryClient does not retry a 4xx, so this is the failure the
    // interface has to be able to show.
    server.use(http.get('/api/session', () => new HttpResponse(null, { status: 403 })))

    renderApp('/shops/the-fade-room')

    // Not silence: silence here is indistinguishable from being signed out, and
    // would leave a signed-in Account with no way to sign out.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not check who is signed in.',
    )
  })

  it('keeps an Account signed in across a remount', async () => {
    const first = renderApp('/login')

    await signIn(account.email, account.password)
    expect(await screen.findByText(`Signed in as ${account.email}`)).toBeVisible()

    // A fresh router and a fresh QueryClient — nothing carries over but the
    // cookie, which is what a page reload leaves behind too.
    first.unmount()
    renderApp('/shops/the-fade-room')

    expect(await screen.findByText(`Signed in as ${account.email}`)).toBeVisible()
  })

  it('signs out, ending the session and returning to the login route', async () => {
    const user = userEvent.setup()
    const first = renderApp('/login')

    await signIn(account.email, account.password)
    await screen.findByText(`Signed in as ${account.email}`)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect(screen.queryByText(`Signed in as ${account.email}`)).not.toBeInTheDocument()

    // The session ended at the API, not merely in this tab's cache: a fresh
    // load asking for a protected route is turned away by the guard, which can
    // only be answering from what the API says.
    first.unmount()
    renderApp('/shops/the-fade-room')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect(screen.queryByText(`Signed in as ${account.email}`)).not.toBeInTheDocument()
  })
})
