import { http, HttpResponse } from 'msw'

import { membershipSchema } from '@/contract/membership'
import { accountSchema, credentialsSchema, sessionSchema } from '@/contract/session'
import { shopSchema } from '@/contract/shop'
import { db } from './db'
import { sessionTokenFor } from './seed'

/** The cookie the mock issues. The application never names it — only this file does. */
const SESSION_COOKIE = 'session'

/**
 * A real backend would set `HttpOnly` here and the browser would keep the value
 * out of reach of every script on the page. MSW cannot: it applies a mocked
 * `Set-Cookie` through `document.cookie`, which browsers ignore for `HttpOnly`
 * cookies, so asking for one would mean issuing no cookie at all. Until the
 * real backend exists, what stands in for it is a rule the code keeps rather
 * than one the browser enforces: nothing outside this file reads the cookie.
 */
function sessionCookie(token: string | null): string {
  return token === null
    ? `${SESSION_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`
    : `${SESSION_COOKIE}=${token}; Path=/; SameSite=Lax`
}

function accountForSession(token: string | undefined) {
  if (!token) {
    return null
  }

  const session = db.session.findFirst({ where: { token: { equals: token } } })
  if (!session) {
    return null
  }

  return db.account.findFirst({ where: { id: { equals: session.accountId } } })
}

function membershipsForAccount(accountId: string) {
  return db.membership
    .findMany({ where: { accountId: { equals: accountId } } })
    .map((membership) => membershipSchema.parse(membership))
}

function sessionFor(account: { id: string; email: string }) {
  return sessionSchema.parse({
    account: accountSchema.parse(account),
    memberships: membershipsForAccount(account.id),
  })
}

/**
 * The mock API. This array is exported once and mounted twice — by the browser
 * worker in development and by `setupServer` in tests — so the two can never
 * drift. Per ADR-0003 handlers hold no business logic: they read the store,
 * call domain functions, and serialise through the contract schemas.
 */
export const handlers = [
  // Signing in. The credentials are parsed with the same schema the login form
  // validates against, so a request the form would have refused is refused here
  // too — the form is a convenience, not the gate.
  http.post('/api/session', async ({ request }) => {
    const credentials = credentialsSchema.safeParse(await request.json())

    if (!credentials.success) {
      return new HttpResponse(null, { status: 400 })
    }

    const account = db.account.findFirst({
      where: { email: { equals: credentials.data.email } },
    })

    // One status for both an unknown email and a wrong password, so that the
    // response cannot be used to discover which addresses have an Account.
    if (!account || account.password !== credentials.data.password) {
      return new HttpResponse(null, { status: 401 })
    }

    const token = sessionTokenFor(account.id)

    // Re-created rather than assumed: a previous sign-out in this same load
    // deleted the row the seed put here.
    if (!db.session.findFirst({ where: { token: { equals: token } } })) {
      db.session.create({ token, accountId: account.id })
    }

    // `accountSchema` names no password, and `z.object` drops what it does not
    // name, so the stored password cannot leave through this response.
    return HttpResponse.json(sessionFor(account), {
      headers: { 'Set-Cookie': sessionCookie(token) },
    })
  }),

  // Reading the current session. 401 is the answer for a signed-out visitor
  // rather than a failure, and the query layer turns it into `null`.
  http.get('/api/session', ({ cookies }) => {
    const account = accountForSession(cookies[SESSION_COOKIE])

    if (!account) {
      return new HttpResponse(null, { status: 401 })
    }

    return HttpResponse.json(sessionFor(account))
  }),

  // Signing out. Idempotent: someone whose session already ended should be able
  // to sign out again and get the same answer.
  http.delete('/api/session', ({ cookies }) => {
    const token = cookies[SESSION_COOKIE]

    if (token) {
      db.session.delete({ where: { token: { equals: token } } })
    }

    return new HttpResponse(null, {
      status: 204,
      headers: { 'Set-Cookie': sessionCookie(null) },
    })
  }),

  http.get('/api/shops/:shopId', ({ params, cookies }) => {
    const shopId = String(params.shopId)
    const account = accountForSession(cookies[SESSION_COOKIE])
    const shop = db.shop.findFirst({ where: { id: { equals: shopId } } })
    const membership =
      account &&
      db.membership.findFirst({
        where: { accountId: { equals: account.id }, shopId: { equals: shopId } },
      })

    // Not found rather than forbidden, and the same not-found whether the Shop
    // does not exist at all or exists but this Account holds no Membership in
    // it: a forbidden response — or a response that merely looked different —
    // would confirm the Shop exists, leaking one tenant's existence to another.
    // This is the boundary itself, not merely the route guard's mirror of it:
    // the guard exists so the interface never asks in the first place, but the
    // data has to refuse on its own, or the guard would be the only thing
    // stopping a request sent by hand.
    if (!shop || !membership) {
      return new HttpResponse(null, { status: 404 })
    }

    return HttpResponse.json(shopSchema.parse(shop))
  }),
]
