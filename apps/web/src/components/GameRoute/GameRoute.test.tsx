import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import Root from '../../root'
import Five from '../../routes/five'
import { deferred, fixturePageData } from '../../test/fixtures'
import type { GamePageData } from '../../api/page-data'

describe('game route loading', () => {
  it('hydrates existing results without clearing them, then retains them on refresh failure', async () => {
    const data = fixturePageData('five')
    const refresh = deferred<GamePageData>()
    const loader = vi.fn(() => refresh.promise)
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: Root,
          children: [
            { id: 'game', path: 'otoslotto', Component: Five, loader },
          ],
        },
      ],
      {
        initialEntries: ['/otoslotto'],
        hydrationData: { loaderData: { game: data } },
      },
    )
    const container = document.createElement('div')
    document.body.append(container)
    container.innerHTML = renderToString(<RouterProvider router={router} />)
    const heading = container.querySelector('h1')
    const recovery = vi.fn()
    const root = hydrateRoot(container, <RouterProvider router={router} />, {
      onRecoverableError: recovery,
    })
    try {
      await waitFor(() => expect(loader).toHaveBeenCalledTimes(1))
      expect(router.state.revalidation).toBe('loading')
      expect(container.querySelector('h1')).toBe(heading)
      expect(
        screen.getByRole('heading', { name: 'Számgyakoriság' }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/Az oldal betöltése/)).not.toBeInTheDocument()
      await act(async () =>
        refresh.resolve({
          ...data,
          refreshError: 'Az adatok átmenetileg nem érhetők el.',
        }),
      )
      expect(container.querySelector('h1')).toBe(heading)
      expect(screen.getByRole('status')).toHaveTextContent(
        'Az adatok átmenetileg nem érhetők el.',
      )
      expect(recovery).not.toHaveBeenCalled()
      expect(loader).toHaveBeenCalledTimes(1)
    } finally {
      await act(async () => root.unmount())
      router.dispose()
      container.remove()
    }
  })

  it('keeps the current page during pending navigation without inserting a loading message', async () => {
    const next = deferred<GamePageData>()
    const router = createMemoryRouter([
      {
        path: '/',
        Component: Root,
        children: [
          { index: true, element: <h1>Meglévő tartalom</h1> },
          { path: 'otoslotto', Component: Five, loader: () => next.promise },
        ],
      },
    ])
    render(<RouterProvider router={router} />)
    fireEvent.click(screen.getByRole('link', { name: 'Ötöslottó' }))
    expect(
      screen.getByRole('heading', { name: 'Meglévő tartalom' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await act(async () => next.resolve(fixturePageData('five')))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ötöslottó' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false')
    router.dispose()
  })
})
