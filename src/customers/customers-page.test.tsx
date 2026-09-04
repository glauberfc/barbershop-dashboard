import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { server } from '@/mock/server'
import { seedAccounts } from '@/mock/seed'
import { renderApp } from '@/test/render-app'
import { signInOverTheApi } from '@/test/sign-in'

const [owner] = seedAccounts

describe('the Customers page', () => {
  beforeEach(() => signInOverTheApi(owner))

  it('shows a fixture Customer, with contact details visible', async () => {
    renderApp('/shops/the-fade-room/customers')

    expect(await screen.findByText('Marta Silva')).toBeVisible()
    expect(screen.getByText('+351 912 345 001')).toBeVisible()

    const beatriz = screen.getByText('Beatriz Costa').closest('li')!
    expect(within(beatriz).getByText('beatriz.costa@example.test')).toBeVisible()
  })

  it("does not show another Shop's Customers on this Shop's page", async () => {
    renderApp('/shops/the-fade-room/customers')

    await screen.findByText('Marta Silva')

    expect(screen.queryByText('Inês Ferreira')).not.toBeInTheDocument()
  })

  it("shows a different Shop's own Customers at its own address", async () => {
    renderApp('/shops/north-lane-barbers/customers')

    expect(await screen.findByText('Inês Ferreira')).toBeVisible()
    expect(screen.queryByText('Marta Silva')).not.toBeInTheDocument()
  })

  it('searches Customers by name', async () => {
    renderApp('/shops/the-fade-room/customers')

    await screen.findByText('Marta Silva')
    expect(screen.getByText('Tiago Alves')).toBeVisible()

    await userEvent.setup().type(screen.getByLabelText('Search by name'), 'Marta')

    expect(await screen.findByText('Marta Silva')).toBeVisible()
    expect(screen.queryByText('Tiago Alves')).not.toBeInTheDocument()
  })

  it('shows a distinct "no results" state for a search that matches nobody', async () => {
    renderApp('/shops/the-fade-room/customers')

    await screen.findByText('Marta Silva')
    await userEvent.setup().type(screen.getByLabelText('Search by name'), 'Nobody Here')

    expect(await screen.findByText('No Customers match “Nobody Here”.')).toBeVisible()
  })

  it('reports a failure and can be retried', async () => {
    // A 4xx, not a 5xx: the query layer retries a 5xx automatically — see
    // `createQueryClient` — which would make this test wait through several
    // seconds of backoff before the error state ever appears.
    server.use(http.get('/api/shops/:shopId/customers', () => new HttpResponse(null, { status: 400 })))

    renderApp('/shops/the-fade-room/customers')

    expect(await screen.findByText('Could not load Customers.')).toBeVisible()

    server.resetHandlers()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Marta Silva')).toBeVisible()
  })

  it('adds a Customer, validated by the same schema the API parses with, and shows it without a page reload', async () => {
    renderApp('/shops/the-fade-room/customers')
    await screen.findByText('Marta Silva')

    const user = userEvent.setup()

    // Submitting with no name at all is refused before it is ever sent.
    await user.click(screen.getByRole('button', { name: 'Add Customer' }))
    expect(await screen.findByText('Enter a name.')).toBeVisible()

    await user.type(screen.getByLabelText('Name'), 'Nova Sousa')
    await user.type(screen.getByLabelText('Phone'), '+351 910 000 999')
    await user.click(screen.getByRole('button', { name: 'Add Customer' }))

    expect(await screen.findByText('Nova Sousa')).toBeVisible()
    expect(screen.getByText('+351 910 000 999')).toBeVisible()
  })

  it('rejects an invalid email before the request is ever sent', async () => {
    const requested: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') {
        requested.push(new URL(request.url).pathname)
      }
    })

    renderApp('/shops/the-fade-room/customers')
    await screen.findByText('Marta Silva')

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Name'), 'Nova Sousa')
    await user.type(screen.getByLabelText('Phone'), '+351 910 000 999')
    await user.type(screen.getByLabelText('Email (optional)'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Add Customer' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeVisible()
    expect(requested).toEqual([])
  })
})
