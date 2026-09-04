import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Drives the login form the way an Account would: no credential is ever handed
 * to the application other than through the fields on screen.
 *
 * An empty value is typed as an empty field rather than skipped, so that a test
 * can submit the form with nothing in it.
 */
export async function signInThroughTheForm(email: string, password: string) {
  const user = userEvent.setup()

  if (email) {
    await user.type(await screen.findByLabelText('Email'), email)
  }
  if (password) {
    await user.type(await screen.findByLabelText('Password'), password)
  }
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

/**
 * Puts a session in the cookie jar without rendering anything, for tests that
 * need to start signed in but are not about signing in. It goes through the
 * same endpoint the form posts to, so what it leaves behind is exactly what a
 * sign-in leaves behind — a cookie, and nothing in the application.
 */
export async function signInOverTheApi(account: { email: string; password: string }) {
  const response = await fetch(new URL('/api/session', window.location.origin), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  })

  if (!response.ok) {
    throw new Error(`Could not sign in as ${account.email}: the API answered ${response.status}`)
  }
}
