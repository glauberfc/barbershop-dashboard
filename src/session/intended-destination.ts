/**
 * Where an Account was headed when the guard turned it away, and where signing
 * in should put it back. The guard writes it onto the login route's address and
 * the login route reads it, so this module is the one place that knows the
 * search parameter is called `redirect`.
 */
export const NO_INTENDED_DESTINATION = '/'

/**
 * The intended destination, if the address carries one this application is
 * willing to send anyone to.
 *
 * Only a path within this application is ever accepted. The value arrives in
 * the address bar, where anyone able to get a link clicked can write it, and
 * `/login?redirect=https://evil.test` that hands the Account to another site
 * the instant it signs in is the classic open redirect — phishing wearing our
 * own domain and our own login form. `//evil.test` is the same attack spelled
 * protocol-relatively: a path by the letter of "starts with a slash", another
 * origin in practice. A backslash after the slash is how some browsers have
 * been persuaded to read the same thing.
 */
export function readIntendedDestination(search: Record<string, unknown>): string | undefined {
  const destination = search.redirect

  if (typeof destination !== 'string' || !destination.startsWith('/')) {
    return undefined
  }

  if (destination.startsWith('//') || destination.startsWith('/\\')) {
    return undefined
  }

  return destination
}
