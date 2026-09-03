import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '@/test/render-app'

describe('reading a Shop', () => {
  it("shows the Shop's name", async () => {
    renderApp('/shops/the-fade-room')

    expect(await screen.findByRole('heading', { name: 'The Fade Room' })).toBeVisible()
  })

  it('shows a different Shop at a different address', async () => {
    renderApp('/shops/north-lane-barbers')

    expect(await screen.findByRole('heading', { name: 'North Lane Barbers' })).toBeVisible()
  })

  it('reports a failure rather than rendering an empty Shop', async () => {
    renderApp('/shops/no-such-shop')

    expect(await screen.findByText('Could not load this Shop.')).toBeVisible()
  })

  it("does not serve a Shop's data under an address that is not its own", async () => {
    // `the-fade-room?foo=bar` names no Shop. Were the identifier interpolated
    // into the request unencoded, it would resolve to the Fade Room's endpoint
    // with a query string attached and render that Shop under a foreign key.
    renderApp('/shops/the-fade-room%3Ffoo%3Dbar')

    expect(await screen.findByText('Could not load this Shop.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'The Fade Room' })).not.toBeInTheDocument()
  })
})
