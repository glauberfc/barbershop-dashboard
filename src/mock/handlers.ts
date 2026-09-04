import { http, HttpResponse } from 'msw'

import { appointmentRangeSchema, appointmentSchema } from '@/contract/appointment'
import { barberSchema } from '@/contract/barber'
import { createCustomerSchema, customerSchema } from '@/contract/customer'
import { membershipSchema } from '@/contract/membership'
import { serviceSchema } from '@/contract/service'
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

/**
 * The tenant boundary, shared by every Shop-scoped handler below. `null` means
 * "answer not found" — whether because the Shop does not exist, the visitor is
 * signed out, or the Account holds no Membership here — never forbidden, per
 * the contract decision in ticket #1: a forbidden response would confirm the
 * Shop exists, which leaks one tenant's existence to another.
 */
function shopForAccount(shopId: string, cookies: Record<string, string>) {
  const account = accountForSession(cookies[SESSION_COOKIE])
  const shop = db.shop.findFirst({ where: { id: { equals: shopId } } })
  const membership =
    account &&
    db.membership.findFirst({
      where: { accountId: { equals: account.id }, shopId: { equals: shopId } },
    })

  return shop && membership ? shop : null
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
    // This is the boundary itself, not merely the route guard's mirror of it:
    // the guard exists so the interface never asks in the first place, but the
    // data has to refuse on its own, or the guard would be the only thing
    // stopping a request sent by hand.
    const shop = shopForAccount(String(params.shopId), cookies)

    if (!shop) {
      return new HttpResponse(null, { status: 404 })
    }

    return HttpResponse.json(shopSchema.parse(shop))
  }),

  http.get('/api/shops/:shopId/barbers', ({ params, cookies }) => {
    const shopId = String(params.shopId)

    if (!shopForAccount(shopId, cookies)) {
      return new HttpResponse(null, { status: 404 })
    }

    const barbers = db.barber.findMany({ where: { shopId: { equals: shopId } } })

    return HttpResponse.json(barbers.map((barber) => barberSchema.parse(barber)))
  }),

  http.get('/api/shops/:shopId/services', ({ params, cookies }) => {
    const shopId = String(params.shopId)

    if (!shopForAccount(shopId, cookies)) {
      return new HttpResponse(null, { status: 404 })
    }

    const services = db.service.findMany({ where: { shopId: { equals: shopId } } })

    return HttpResponse.json(services.map((service) => serviceSchema.parse(service)))
  }),

  // Searched by name with `?q=`, per ticket #7. Matched case-insensitively and
  // in the handler rather than through a store query, since `@mswjs/data`'s
  // `contains` is case-sensitive and this Shop's Customers are few enough that
  // filtering them in memory costs nothing worth a cleverer query. A Customer
  // never carries an email it does not have — `nullable(String)`'s `null` is
  // dropped here rather than sent as a literal `null`, so the wire matches
  // `customerSchema`'s `.optional()` exactly.
  http.get('/api/shops/:shopId/customers', ({ params, cookies, request }) => {
    const shopId = String(params.shopId)

    if (!shopForAccount(shopId, cookies)) {
      return new HttpResponse(null, { status: 404 })
    }

    const query = new URL(request.url).searchParams.get('q')?.trim().toLowerCase()

    const customers = db.customer
      .findMany({ where: { shopId: { equals: shopId } } })
      .filter((customer) => !query || customer.name.toLowerCase().includes(query))

    return HttpResponse.json(
      customers.map((customer) =>
        customerSchema.parse({ ...customer, email: customer.email ?? undefined }),
      ),
    )
  }),

  // Creating a Customer, per ticket #7. No Account is created or required, per
  // ADR-0001 — a Customer is only ever this Shop's own record of a person.
  http.post('/api/shops/:shopId/customers', async ({ params, cookies, request }) => {
    const shopId = String(params.shopId)

    if (!shopForAccount(shopId, cookies)) {
      return new HttpResponse(null, { status: 404 })
    }

    const body = createCustomerSchema.safeParse(await request.json())

    if (!body.success) {
      return new HttpResponse(null, { status: 400 })
    }

    const customer = db.customer.create({
      id: `customer-${crypto.randomUUID()}`,
      shopId,
      name: body.data.name,
      phone: body.data.phone,
      email: body.data.email ?? null,
    })

    return HttpResponse.json(
      customerSchema.parse({ ...customer, email: customer.email ?? undefined }),
      { status: 201 },
    )
  }),

  // Every Barber's Appointments for a date range in one request, per ticket
  // #6 — never one request per Barber. `from`/`to` are UTC instants: the day
  // view is what converts a Shop-local calendar day into this range, per
  // ADR-0002.
  http.get('/api/shops/:shopId/appointments', ({ params, cookies, request }) => {
    const shopId = String(params.shopId)

    if (!shopForAccount(shopId, cookies)) {
      return new HttpResponse(null, { status: 404 })
    }

    const url = new URL(request.url)
    const range = appointmentRangeSchema.safeParse({
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    })

    if (!range.success) {
      return new HttpResponse(null, { status: 400 })
    }

    const appointments = db.appointment.findMany({
      where: {
        shopId: { equals: shopId },
        start: { gte: range.data.from, lt: range.data.to },
      },
    })

    return HttpResponse.json(appointments.map((appointment) => appointmentSchema.parse(appointment)))
  }),
]
