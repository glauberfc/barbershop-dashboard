import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { server } from '@/mock/server'
import { seedAccounts } from '@/mock/seed'
import { shiftDate, todayInShop } from '@/scheduling/day-range'
import { renderApp } from '@/test/render-app'
import { signInOverTheApi } from '@/test/sign-in'

const [owner] = seedAccounts
const SHOP_TIMEZONE = 'Europe/Lisbon'

/** The nearest day, strictly after today, that the seed's generator leaves quiet. */
function nextQuietDay(): string {
  let date = todayInShop(SHOP_TIMEZONE)

  for (let i = 0; i < 13; i++) {
    date = shiftDate(date, 1)
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    if (weekday === 0) {
      return date
    }
  }

  throw new Error('Could not find a Sunday within the seeded range')
}

describe('the day view', () => {
  beforeEach(() => signInOverTheApi(owner))

  it("shows today's Appointments grouped by Barber, with the Customer, the Service and the time", async () => {
    renderApp('/shops/the-fade-room')

    const marco = (await screen.findByRole('heading', { name: 'Marco Dias' })).closest<HTMLElement>(
      '[data-slot="card"]',
    )!
    expect(within(marco).getByText(/09:00/)).toBeVisible()
    expect(within(marco).getByText(/Marta Silva/)).toBeVisible()
    expect(within(marco).getByText('Haircut')).toBeVisible()

    const sofia = screen.getByRole('heading', { name: 'Sofia Teixeira' }).closest<HTMLElement>('[data-slot="card"]')!
    expect(within(sofia).getByText(/10:00/)).toBeVisible()
    expect(within(sofia).getByText(/Rui Pereira/)).toBeVisible()
  })

  it("renders the Appointment's time in the Shop's timezone, not the viewer's", async () => {
    // The test environment's own clock is not Europe/Lisbon (see vitest setup
    // and the CI environment) — this is Marta Silva's fixture Appointment,
    // seeded for 09:00 Lisbon time. Seeing anything else here would mean the
    // day view rendered the viewer's own timezone instead, per ADR-0002.
    renderApp('/shops/the-fade-room')

    expect(await screen.findByText(/09:00 — Marta Silva/)).toBeVisible()
  })

  it('shows a Cancelled Appointment, visually distinct, rather than hiding it', async () => {
    renderApp('/shops/the-fade-room')

    const cancelled = await screen.findByText(/Beatriz Costa/)
    expect(cancelled).toBeVisible()
    expect(await screen.findByText(/Cancelled/)).toBeVisible()
  })

  it('shows a clear empty state on a quiet day, distinct from a loading or failed one', async () => {
    renderApp(`/shops/the-fade-room?date=${nextQuietDay()}`)

    expect(await screen.findByText('Nothing booked for this day.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Marco Dias' })).not.toBeInTheDocument()
  })

  it('reports a failure and can be retried without reloading the page', async () => {
    // A 4xx rather than a 5xx: the query layer's retry policy — see
    // `createQueryClient` — retries a 5xx automatically, which would make this
    // test wait through several seconds of backoff before the error state
    // this test is about ever appears.
    server.use(
      http.get('/api/shops/:shopId/appointments', () => new HttpResponse(null, { status: 400 })),
    )

    renderApp('/shops/the-fade-room')

    expect(await screen.findByText('Could not load the day.')).toBeVisible()

    // The next request succeeds again, the way a real hiccup would recover.
    server.resetHandlers()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText(/Marta Silva/)).toBeVisible()
  })

  it('moves to the next and previous day, and back to today', async () => {
    renderApp('/shops/the-fade-room')

    await screen.findByText(/Marta Silva/)
    const todayHeading = screen.getByRole('heading', { level: 2 }).textContent

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Next day' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(todayHeading)
    })
    expect(screen.queryByText(/Marta Silva/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(todayHeading)
    })
    expect(await screen.findByText(/Marta Silva/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Next day' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(todayHeading)
    })
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(todayHeading)
    })
  })

  it("fetches a day's Appointments for every Barber in one request", async () => {
    const requested: string[] = []
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url)
      if (url.pathname.endsWith('/appointments')) {
        requested.push(url.pathname)
      }
    })

    renderApp('/shops/the-fade-room')
    await screen.findByText(/Marta Silva/)

    // Never one request per Barber: every request this page made for
    // Appointments named the same, single, Shop-wide endpoint.
    expect(requested.length).toBeGreaterThan(0)
    expect(new Set(requested)).toEqual(new Set(['/api/shops/the-fade-room/appointments']))
  })
})
