import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
  it('retries filtered page-one history through the population snapshot', async () => {
    let failHistory = true
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), 'http://fixture.test')
      if (failHistory && url.pathname.endsWith('/drawings'))
        return Response.json({}, { status: 503 })
      return fixtureApiResponse(String(input))
    })
    vi.stubGlobal('fetch', fetcher)
    const router = createMemoryRouter(
      [
        {
          path: '/otoslotto',
          element: <GamePage game="five" data={fixturePageData('five')} />,
        },
      ],
      { initialEntries: ['/otoslotto?year=2023&page=1'] },
    )
    routers.push(router)
    render(<RouterProvider router={router} />)
    const history = screen.getByRole('region', { name: 'Korábbi eredmények' })
    const alert = await within(history).findByRole('alert')
    const initialRequests = fetcher.mock.calls.length
    failHistory = false
    fireEvent.click(
      within(alert).getByRole('button', { name: 'Újrapróbálkozás' }),
    )
    await within(history).findByText('1, 12, 23, 34, 45', { exact: false })
    expect(within(history).queryByRole('alert')).not.toBeInTheDocument()
    expect(fetcher.mock.calls.length).toBeGreaterThan(initialRequests)
    expect(router.state.location.search).toBe('?year=2023&page=1')
    const requests = fetcher.mock.calls
      .map(([input]) => new URL(String(input), 'http://fixture.test'))
      .filter((url) => url.pathname.endsWith('/drawings'))
    expect(requests).toHaveLength(2)
    for (const url of requests) {
      expect(url.searchParams.get('year')).toBe('2023')
      expect(url.searchParams.has('page')).toBe(false)
    }
  })

  it('reuses history across scope changes and resets population filters to page one', async () => {
    const fixture = fixtureResponses('scandinavian')
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), 'http://fixture.test')
      if (url.pathname.endsWith('/drawings'))
        return Response.json({
          ...fixture.history,
          meta: {
            ...fixture.history.meta,
            current_page: Number(url.searchParams.get('page') ?? 1),
            last_page: 9,
            per_page: 5,
            total: 45,
          },
        })
      return fixtureApiResponse(String(input))
    })
    vi.stubGlobal('fetch', fetcher)
    const router = createMemoryRouter(
      [
        {
          path: '/skandinav-lotto',
          element: (
            <GamePage
              game="scandinavian"
              data={fixturePageData('scandinavian')}
            />
          ),
        },
      ],
      { initialEntries: ['/skandinav-lotto?year=2025&page=2'] },
    )
    routers.push(router)
    render(<RouterProvider router={router} />)
    const history = screen.getByRole('region', { name: 'Korábbi eredmények' })
    await waitFor(() =>
      expect(within(history).getByRole('navigation')).toHaveAttribute(
        'aria-busy',
        'false',
      ),
    )
    const historyRequests = () =>
      fetcher.mock.calls
        .map(([input]) => new URL(String(input), 'http://fixture.test'))
        .filter((url) => url.pathname.endsWith('/drawings'))
    expect(historyRequests()).toHaveLength(2)
    await act(() =>
      router.navigate('/skandinav-lotto?year=2025&page=2&set=manual'),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Szűrés' })).toBeEnabled(),
    )
    expect(historyRequests()).toHaveLength(2)
    expect(
      within(history).getByRole('button', { name: '2. oldal' }),
    ).toHaveAttribute('aria-current', 'page')
    fireEvent.change(screen.getByLabelText('Év'), { target: { value: '2024' } })
    fireEvent.click(screen.getByRole('button', { name: 'Szűrés' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Szűrés' })).toBeEnabled(),
    )
    expect(new URLSearchParams(router.state.location.search).has('page')).toBe(
      false,
    )
    expect(
      within(history).getByRole('button', { name: '1. oldal' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(historyRequests()).toHaveLength(3)
    for (const url of historyRequests())
      expect(url.searchParams.has('set')).toBe(false)
    expect(historyRequests()[2].searchParams.get('year')).toBe('2024')
    expect(historyRequests()[2].searchParams.has('page')).toBe(false)
  })

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
        '?per_page=5&page=5&include=details',
      )
  })

  it('fetches only the requested page and restores cached pages through browser history', async () => {
    const data = fixturePageData('five')
    data.historyPage = { current: 1, last: 727, total: 3631 }
    const fixture = fixtureResponses('five')
    const drawings = vi
      .spyOn(api, 'drawingHistory')
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
