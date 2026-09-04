import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { server } from '@/mock/server'
import { seedAccounts } from '@/mock/seed'
import { renderApp } from '@/test/render-app'
import { signInOverTheApi } from '@/test/sign-in'

const [owner, barber] = seedAccounts

/**
 * Records the paths the application asks the API for, so a test can assert on
 * what it never asked for. A request for a Shop is the sharpest evidence there
 * is that the tenant guard let something through: nothing else in the tree
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
 * Watches every mutation of the document for a fragment of text, so a test can
 * catch a frame that appeared and was thrown away again before a final
 * assertion would ever see it.
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

describe('the tenant boundary', () => {
  it('is not found to a Barber holding no Membership in it, indistinguishably from a Shop that does not exist', async () => {
    // Bruno holds a Membership at North Lane only. The Fade Room is real —
    // Ana runs it — but it does not exist to him.
    await signInOverTheApi(barber)
    const requested = recordRequests()

    renderApp('/shops/the-fade-room')

    expect(await screen.findByText('Could not load this Shop.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'The Fade Room' })).not.toBeInTheDocument()
    // The guard denied the match before the component that reads a Shop was
    // ever created, so the data itself was never asked for — the same rigor
    // ticket #4 holds the authentication guard to.
    expect(requested).not.toContain('GET /api/shops/the-fade-room')
  })

  it('still shows a Barber the Shop it does hold a Membership in', async () => {
    await signInOverTheApi(barber)

    renderApp('/shops/north-lane-barbers')

    expect(await screen.findByRole('heading', { name: 'North Lane Barbers' })).toBeVisible()
  })

  it('lets an Owner switch to a Shop it holds another Membership in, address and all', async () => {
    await signInOverTheApi(owner)
    const { router } = renderApp('/shops/the-fade-room')

    await screen.findByRole('heading', { name: 'The Fade Room' })
    await userEvent.setup().click(screen.getByRole('link', { name: 'North Lane Barbers' }))

    expect(await screen.findByRole('heading', { name: 'North Lane Barbers' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/shops/north-lane-barbers')
  })

  it('never shows the previous Shop once switching has started, not even momentarily', async () => {
    await signInOverTheApi(owner)
    renderApp('/shops/the-fade-room')

    await screen.findByRole('heading', { name: 'The Fade Room' })

    const watcher = watchForFlashOf('The Fade Room')
    // Watched by the same means, so an observer seeing nothing because it was
    // watching nothing cannot pass for the previous Shop never reappearing.
    const control = watchForFlashOf('North Lane Barbers')

    await userEvent.setup().click(screen.getByRole('link', { name: 'North Lane Barbers' }))
    await screen.findByRole('heading', { name: 'North Lane Barbers' })
    watcher.stop()
    control.stop()

    expect(control.flashes).not.toEqual([])
    expect(watcher.flashes).toEqual([])
  })
})
