import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  fixtureGames,
  fixtureResponses,
  fixturePageData,
} from '../test/fixtures'

let testTime = Date.parse('2026-11-01T00:00:00Z')
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  testTime += 60_000
  vi.setSystemTime(testTime)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
function renderRoute(path: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/games')) return Response.json(fixtureGames)
      const game = url.includes('/scandinavian/')
        ? 'scandinavian'
        : url.includes('/six/')
          ? 'six'
          : 'five'
      const fixture = fixtureResponses(game)
      const query = new URL(url, 'http://test').searchParams
      return Response.json(
        url.includes('/summary')
          ? fixture.summary
          : url.includes('/frequencies')
            ? query.get('sort') === 'most'
              ? fixture.mostFrequencies
              : query.get('sort') === 'least'
                ? fixture.leastFrequencies
                : fixture.frequencies
            : url.includes('/parity')
              ? fixture.parity
              : url.includes('/drawings?')
                ? fixture.history
                : fixture.drawing,
      )
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
  return render(<RouterProvider router={router} />)
}
describe('explicit route modules', () => {
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
