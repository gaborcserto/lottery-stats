import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Root, { HydrateFallback } from '../root'
import Home, * as home from './home'
import Five, * as five from './five'
import Six, * as six from './six'
import Scandinavian, * as scandinavian from './scandinavian'
import NotFound from './not-found'
import { ApiError } from '../api/client'
import {
  fixtureApiResponse,
  fixtureResponses,
  fixturePageData,
} from '../test/fixtures'

let testTime = Date.parse('2026-11-01T00:00:00Z')
const routers: ReturnType<typeof createMemoryRouter>[] = []
beforeEach(() => {
  // Navigation tests keep charts below the viewport; ChartSlot tests exercise entry.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  testTime += 60_000
  vi.setSystemTime(testTime)
})
afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose())
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function renderRoute(path: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (input) => {
      return fixtureApiResponse(String(input))
    }),
  )
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: Root,
        HydrateFallback,
        children: [
          {
            index: true,
            Component: Home,
            loader: () => ({
              latest: [
                {
                  game: 'five' as const,
                  drawing: fixtureResponses('five').drawing.data,
                },
                {
                  game: 'six' as const,
                  drawing: fixtureResponses('six').drawing.data,
                },
                {
                  game: 'scandinavian' as const,
                  drawing: fixtureResponses('scandinavian').drawing.data,
                },
              ],
              capturedAt: '2026-10-10T00:00:00.000Z',
            }),
            ErrorBoundary: home.ErrorBoundary,
          },
          {
            path: 'otoslotto',
            Component: Five,
            shouldRevalidate: five.shouldRevalidate,
            loader: ({ request }) =>
              five.clientLoader({
                request,
                serverLoader: async () => fixturePageData('five'),
              }),
            ErrorBoundary: five.ErrorBoundary,
          },
          {
            path: 'hatoslotto',
            Component: Six,
            shouldRevalidate: six.shouldRevalidate,
            loader: ({ request }) =>
              six.clientLoader({
                request,
                serverLoader: async () => fixturePageData('six'),
              }),
            ErrorBoundary: six.ErrorBoundary,
          },
          {
            path: 'skandinav-lotto',
            Component: Scandinavian,
            shouldRevalidate: scandinavian.shouldRevalidate,
            loader: ({ request }) =>
              scandinavian.clientLoader({
                request,
                serverLoader: async () => fixturePageData('scandinavian'),
              }),
            ErrorBoundary: scandinavian.ErrorBoundary,
          },
          { path: '*', Component: NotFound },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}
describe('explicit route modules', () => {
  it.each([
    ['/otoslotto', 'Ötöslottó', '1, 12, 23, 34, 45'],
    ['/hatoslotto', 'Hatoslottó', '1, 12, 23, 34, 44, 45'],
    ['/skandinav-lotto', 'Skandináv lottó', '2, 6, 13, 24, 29, 33, 35'],
  ])(
    'opens %s from its homepage card and returns through the logo',
    async (path, title, numbers) => {
      const router = renderRoute('/')
      const cards = await screen.findByRole('region', {
        name: 'Válassz egy játékot',
      })
      const card = within(cards)
        .getAllByRole('link')
        .find((link) => link.getAttribute('href') === path)
      if (!card) throw new Error('Missing game card')
      await act(async () => fireEvent.click(card))
      const main = screen.getByRole('main')
      await within(main).findByRole('heading', { level: 1, name: title })
      expect(router.state.location.pathname).toBe(path)
      expect(
        within(main).getByText(numbers, { exact: false }),
      ).toBeInTheDocument()
      expect(
        within(
          screen.getByRole('navigation', { name: 'Fő navigáció' }),
        ).getByRole('link', { name: title }),
      ).toHaveAttribute('aria-current', 'page')
      await act(async () =>
        fireEvent.click(
          screen.getByRole('link', { name: 'Lottery Stats – Kezdőlap' }),
        ),
      )
      await within(screen.getByRole('main')).findByRole('heading', {
        level: 1,
        name: 'A számok mögött.',
      })
      expect(router.state.location.pathname).toBe('/')
      expect(screen.queryByText('Adatok betöltése…')).not.toBeInTheDocument()
    },
  )

  it('preserves theme through game navigation and back/forward with no other game data', async () => {
    const router = renderRoute('/otoslotto')
    await screen.findByRole('heading', { level: 1, name: 'Ötöslottó' })
    const main = screen.getByRole('main')
    fireEvent.click(screen.getByRole('button', { name: 'Sötét' }))
    const nav = screen.getByRole('navigation', { name: 'Fő navigáció' })
    for (const title of ['Hatoslottó', 'Skandináv lottó']) {
      await act(async () =>
        fireEvent.click(within(nav).getByRole('link', { name: title })),
      )
      await within(main).findByRole('heading', { level: 1, name: title })
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
      expect(within(nav).getByRole('link', { name: title })).toHaveAttribute(
        'aria-current',
        'page',
      )
    }
    expect(within(main).getByText('Kézi számsor')).toBeInTheDocument()
    await act(() => router.navigate(-1))
    await within(main).findByRole('heading', { level: 1, name: 'Hatoslottó' })
    expect(within(main).queryByText('Kézi számsor')).not.toBeInTheDocument()
    await act(() => router.navigate(1))
    await within(main).findByRole('heading', {
      level: 1,
      name: 'Skandináv lottó',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Világos' }))
    expect(localStorage.getItem('lottery-stats-theme')).toBe('light')
  })

  it('closes the mobile disclosure on Escape and navigation and restores toggle focus', async () => {
    renderRoute('/')
    await screen.findByRole('heading', { level: 1, name: 'A számok mögött.' })
    fireEvent.click(screen.getByRole('button', { name: 'Menü megnyitása' }))
    const close = screen.getByRole('button', { name: 'Menü bezárása' })
    expect(close).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(close, { key: 'Escape' })
    expect(
      screen.getByRole('button', { name: 'Menü megnyitása' }),
    ).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Menü megnyitása' }))
    fireEvent.click(screen.getByRole('link', { name: 'Ötöslottó' }))
    await screen.findByRole('heading', { level: 1, name: 'Ötöslottó' })
    expect(
      screen.getByRole('button', { name: 'Menü megnyitása' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByRole('navigation', { name: 'Fő navigáció' }),
    ).toHaveAttribute('data-open', 'false')
  })

  it('renders a genuine API failure with a deterministic Hungarian error title', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([
      {
        path: '/',
        Component: Root,
        HydrateFallback,
        children: [
          {
            index: true,
            Component: Home,
            loader: () => {
              throw new ApiError('server')
            },
            ErrorBoundary: home.ErrorBoundary,
          },
        ],
      },
    ])
    try {
      render(<RouterProvider router={router} />)
      expect(
        await screen.findByRole('heading', {
          name: 'Váratlan hiba történt',
        }),
      ).toBeInTheDocument()
      expect(document.title).toBe('Váratlan hiba történt | Lottery Stats')
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
      router.dispose()
    }
  })
  it.each([
    ['/', 'A számok mögött.'],
    ['/otoslotto', 'Ötöslottó'],
    ['/hatoslotto', 'Hatoslottó'],
    ['/skandinav-lotto', 'Skandináv lottó'],
  ])('renders direct navigation to %s', async (path, heading) => {
    renderRoute(path)
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: heading },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument()
  })

  it('navigates with Laravel browser calls and shows an unknown-path fallback', async () => {
    renderRoute('/about')
    expect(
      await screen.findByRole('heading', { name: 'Az oldal nem található' }),
    ).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: /Vissza a főoldalra/ }))
    await screen.findByRole('heading', { name: 'A számok mögött.' })
    fireEvent.click(screen.getByRole('link', { name: 'Hatoslottó' }))
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Hatoslottó',
      }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/games/six/drawings/latest',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    )
  })
})
