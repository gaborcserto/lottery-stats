import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/client'
import {
  deferred,
  fixtureApiResponse,
  fixturePageData,
  fixtureResponses,
} from '../../test/fixtures'
import { GamePage } from '.'

const routers: ReturnType<typeof createMemoryRouter>[] = []
let time = Date.parse('2027-02-01T00:00:00Z')
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  time += 60_000
  vi.setSystemTime(time)
})
afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('history URL navigation', () => {
  it('retains loaded drawings during a pending page and after failure, then retries only that page', async () => {
    const fixture = fixtureResponses('six')
    const data = fixturePageData('six')
    data.historyPage = { current: 1, last: 9, total: 45 }
    const pending = deferred<Response>()
    let fail = true
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), 'http://fixture.test')
      if (url.pathname.endsWith('/drawings')) {
        if (fail) return pending.promise
        return Response.json({
          ...fixture.history,
          meta: {
            ...fixture.history.meta,
            current_page: 5,
            last_page: 9,
            per_page: 5,
            total: 45,
          },
        })
      }
      return fixtureApiResponse(String(input))
    })
    vi.stubGlobal('fetch', fetcher)
    const router = createMemoryRouter(
      [{ path: '/hatoslotto', element: <GamePage game="six" data={data} /> }],
      { initialEntries: ['/hatoslotto?page=5'] },
    )
    routers.push(router)
    render(<RouterProvider router={router} />)
    expect(screen.getByText('A sorsolások betöltése…')).toBeInTheDocument()
    expect(
      screen.getByText('1, 12, 23, 34, 44, 45', { exact: false }),
    ).toBeInTheDocument()
    await act(async () =>
      pending.resolve(Response.json({ message: 'private' }, { status: 503 })),
    )
    const alert = await screen.findByRole('alert')
    expect(alert).not.toHaveTextContent('private')
    expect(
      screen.queryByText('A sorsolások betöltése…'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('1, 12, 23, 34, 44, 45', { exact: false }),
    ).toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Újrapróbálkozás' }))
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '5. oldal' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    )
    const pages = fetcher.mock.calls.filter(([input]) =>
      new URL(String(input), 'http://fixture.test').pathname.endsWith(
        '/drawings',
      ),
    )
    expect(pages).toHaveLength(2)
    for (const [input] of pages)
      expect(new URL(String(input), 'http://fixture.test').search).toBe(
        '?per_page=5&page=5',
      )
  })
  it('fetches only the requested page and restores cached pages through browser history', async () => {
    const data = fixturePageData('five')
    data.historyPage = { current: 1, last: 727, total: 3631 }
    const fixture = fixtureResponses('five')
    const drawings = vi
      .spyOn(api, 'drawings')
      .mockImplementation(async (_game, query) => ({
        ...fixture.history,
        meta: {
          ...fixture.history.meta,
          current_page: query?.page ?? 1,
          last_page: 727,
          per_page: 5,
          total: 3631,
        },
      }))
    vi.spyOn(api, 'drawing').mockResolvedValue(fixture.drawing)
    const router = createMemoryRouter(
      [{ path: '/otoslotto', element: <GamePage game="five" data={data} /> }],
      { initialEntries: ['/otoslotto?sort=least&number=1'] },
    )
    routers.push(router)
    render(<RouterProvider router={router} />)
    fireEvent.click(screen.getByRole('button', { name: 'Utolsó oldal' }))
    expect(screen.getByText('A sorsolások betöltése…')).toBeInTheDocument()
    expect(
      screen.getByText('1, 12, 23, 34, 45', { exact: false }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '727. oldal' }),
      ).toHaveAttribute('aria-current', 'page'),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('navigation', {
          name: 'Sorsolási előzmények lapozása',
        }),
      ).toHaveAttribute('aria-busy', 'false'),
    )
    expect(drawings).toHaveBeenCalledWith(
      'five',
      { per_page: 5, page: 727 },
      expect.any(AbortSignal),
    )
    expect(router.state.location.search).toBe('?sort=least&number=1&page=727')
    fireEvent.click(screen.getByRole('button', { name: 'Első oldal' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '1. oldal' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    )
    expect(drawings).toHaveBeenCalledTimes(1)
    await act(() => router.navigate(-1))
    await waitFor(() =>
      expect(
        screen.getByRole('navigation', {
          name: 'Sorsolási előzmények lapozása',
        }),
      ).toHaveAttribute('aria-busy', 'false'),
    )
    expect(screen.getByRole('button', { name: '727. oldal' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(drawings).toHaveBeenCalledTimes(1)
    await act(() => router.navigate(1))
    expect(screen.getByRole('button', { name: '1. oldal' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    router.dispose()
  })
})
