import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'
import {
  loadGame,
  loadGameRoute,
  loadGameWithFallback,
  loadHome,
  rememberGamePage,
  rememberHomeData,
} from './page-data'
import { deferred, fixturePageData, fixtureResponses } from '../test/fixtures'

afterEach(() => vi.useRealTimers())

function fixtureFetcher() {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    const game = url.includes('/six/')
      ? 'six'
      : url.includes('/scandinavian/')
        ? 'scandinavian'
        : 'five'
    const fixture = fixtureResponses(game)
    return Response.json(
      url.includes('/summary')
        ? fixture.summary
        : url.includes('/frequencies')
          ? fixture.frequencies
          : url.includes('/pairs')
            ? fixture.pairs
            : url.includes('/trends/yearly')
              ? fixturePageData(game).yearly
              : url.includes('/parity')
                ? fixture.parity
                : url.includes('/drawings?')
                  ? fixture.history
                  : fixture.drawing,
    )
  })
}

describe('game page data loading', () => {
  it('sends intersected filters and Scandinavian combined scope only to supported endpoints', async () => {
    const fixture = fixtureResponses('scandinavian')
    const population = {
      year: 2024,
      week: 53,
      from_date: '2024-01-01',
      to_date: '2024-12-31',
    }
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.includes('/latest')) return Response.json(fixture.drawing)
      if (url.includes('/drawings?')) return Response.json(fixture.history)
      const body = url.includes('/summary')
        ? fixture.summary
        : url.includes('/frequencies')
          ? fixture.frequencies
          : url.includes('/pairs')
            ? fixture.pairs
            : url.includes('/yearly')
              ? {
                  ...fixture.yearly,
                  data: fixture.yearly.data.map((row) => ({
                    ...row,
                    selected_number_count: 1,
                    selected_number_occurrence_percentage: 100,
                  })),
                  meta: { ...fixture.yearly.meta, selected_number: 1 },
                }
              : fixture.parity
      return Response.json({
        ...body,
        meta: { ...body.meta, set_scope: 'combined', filters: population },
      })
    })
    const data = await loadGame(
      createApiClient('https://fixture.test/api/v1', fetcher),
      'scandinavian',
      new AbortController().signal,
      population,
      'combined',
    )
    expect(data.summary.meta.set_scope).toBe('combined')
    expect(data.pairs?.meta.set_scope).toBe('combined')
    expect(data.history[0].sets.map((set) => set.type)).toEqual([
      'machine',
      'manual',
    ])
    for (const [input] of fetcher.mock.calls) {
      const url = new URL(String(input))
      if (url.pathname.includes('/statistics/')) {
        expect(Object.fromEntries(url.searchParams)).toMatchObject({
          year: '2024',
          week: '53',
          from_date: '2024-01-01',
          to_date: '2024-12-31',
          set: 'combined',
        })
      } else if (url.pathname.endsWith('/drawings')) {
        expect(Object.fromEntries(url.searchParams)).toEqual({
          year: '2024',
          week: '53',
          from_date: '2024-01-01',
          to_date: '2024-12-31',
          per_page: '5',
        })
      }
    }
  })
  it('preserves chart tables when a background chart refresh fails', async () => {
    const cached = fixturePageData('six')
    const base = fixtureFetcher()
    const client = createApiClient('/api/v1', (input, init) =>
      String(input).includes('/pairs') || String(input).includes('/yearly')
        ? Promise.resolve(Response.json({}, { status: 503 }))
        : base(input, init),
    )
    rememberGamePage('six', cached, client)
    const refreshed = await loadGameWithFallback(client, 'six')
    expect(refreshed.pairs).toEqual(cached.pairs)
    expect(refreshed.yearly).toEqual(cached.yearly)
    expect(refreshed.pairsError).toBe('Az adatok átmenetileg nem érhetők el.')
    expect(refreshed.yearlyError).toBe('Az adatok átmenetileg nem érhetők el.')
  })
  it('renders native snapshot data on a first visit, then refreshes and caches live data', async () => {
    const fetcher = fixtureFetcher()
    const client = createApiClient('/api/v1', fetcher)
    const snapshot = vi.fn(async () => fixturePageData('five'))
    const signal = new AbortController().signal
    expect(await loadGameRoute(client, 'five', snapshot, signal)).toEqual(
      fixturePageData('five'),
    )
    expect(fetcher).not.toHaveBeenCalled()
    const live = await loadGameRoute(client, 'five', snapshot, signal)
    expect(live.pairs?.data).toEqual(fixtureResponses('five').pairs.data)
    expect(live.yearly?.meta.selected_number).toBe(1)
    expect(fetcher).toHaveBeenCalledTimes(7)
    expect(await loadGameRoute(client, 'five', snapshot, signal)).toBe(live)
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(7)
  })

  it('uses prerendered homepage results for one cache lifetime before refreshing', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'))
    const fetcher = fixtureFetcher()
    const client = createApiClient('/api/v1', fetcher)
    rememberHomeData(
      {
        latest: (['five', 'six', 'scandinavian'] as const).map((game) => ({
          game,
          drawing: fixtureResponses(game).drawing.data,
        })),
        capturedAt: '2026-10-10T11:00:00.000Z',
      },
      client,
    )

    await expect(loadHome(client)).resolves.toMatchObject({
      latest: expect.arrayContaining([
        expect.objectContaining({ game: 'five' }),
        expect.objectContaining({ game: 'six' }),
        expect.objectContaining({ game: 'scandinavian' }),
      ]),
    })
    expect(fetcher).not.toHaveBeenCalled()

    vi.advanceTimersByTime(30_000)
    await loadHome(client)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('reuses homepage latest results and skips their history detail requests', async () => {
    const fetcher = fixtureFetcher()
    const client = createApiClient('/api/v1', fetcher)
    await loadHome(client)
    const data = await loadGameWithFallback(client, 'five')
    expect(data.history[0]).toEqual(data.latest)
    expect(
      fetcher.mock.calls.filter(([url]) =>
        String(url).includes('/five/drawings/latest'),
      ),
    ).toHaveLength(1)
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes('/drawings/7')),
    ).toHaveLength(0)
    await loadHome(client)
    expect(fetcher).toHaveBeenCalledTimes(9)
  })

  it('starts history alongside statistics instead of waiting for a slow summary', async () => {
    const fetcher = fixtureFetcher()
    const response = deferred<Response>()
    const client = createApiClient('/api/v1', (input, init) =>
      String(input).includes('/summary')
        ? response.promise
        : fetcher(input, init),
    )
    const pending = loadGame(client, 'five')
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes('/drawings?')),
    ).toBe(true)
    response.resolve(Response.json(fixtureResponses('five').summary))
    expect((await pending).history).toHaveLength(1)
  })

  it('expires live data after 30 seconds without sharing it between API clients', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-01T00:00:00Z'))
    const fetcher = fixtureFetcher()
    const client = createApiClient('/api/v1', fetcher)
    const first = await loadGameWithFallback(client, 'five')
    vi.setSystemTime(new Date('2026-11-01T00:00:29Z'))
    expect(await loadGameWithFallback(client, 'five')).toBe(first)
    expect(fetcher).toHaveBeenCalledTimes(7)
    vi.setSystemTime(new Date('2026-11-01T00:00:30Z'))
    expect(await loadGameWithFallback(client, 'five')).not.toBe(first)
    expect(fetcher).toHaveBeenCalledTimes(14)
    const otherFetcher = fixtureFetcher()
    await loadGameWithFallback(createApiClient('/other', otherFetcher), 'five')
    expect(otherFetcher).toHaveBeenCalledTimes(7)
  })

  it('retains history on a partial refresh failure and reports the error', async () => {
    const fetcher = fixtureFetcher()
    const client = createApiClient('/api/v1', (input, init) =>
      String(input).includes('/drawings?')
        ? Promise.resolve(Response.json({}, { status: 503 }))
        : fetcher(input, init),
    )
    const snapshot = fixturePageData('five')
    rememberGamePage('five', snapshot, client)
    const data = await loadGameWithFallback(client, 'five')
    expect(data.history).toEqual(snapshot.history)
    expect(data.historyError).toBe('Az adatok átmenetileg nem érhetők el.')
    expect(data.summary.data).toEqual(snapshot.summary.data)
  })

  it('does not use cached content to swallow cancellation', async () => {
    const fetcher = fixtureFetcher()
    const client = createApiClient('/api/v1', fetcher)
    await loadGameWithFallback(client, 'five')
    const controller = new AbortController()
    controller.abort()
    await expect(
      loadGameWithFallback(client, 'five', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher).toHaveBeenCalledTimes(7)
  })

  it('derives frequency highlights from one full frequency request', async () => {
    const fixture = fixtureResponses('five')
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = new URL(String(input), 'http://test').pathname
      const body = url.endsWith('/drawings/latest')
        ? fixture.drawing
        : url.endsWith('/statistics/summary')
          ? fixture.summary
          : url.endsWith('/statistics/frequencies')
            ? fixture.frequencies
            : url.endsWith('/statistics/parity')
              ? fixture.parity
              : fixture.history
      return Promise.resolve(Response.json(body))
    })

    const data = await loadGame(createApiClient('/api/v1', fetcher), 'five')

    expect(
      fetcher.mock.calls.filter(([url]) =>
        String(url).includes('/statistics/frequencies'),
      ),
    ).toHaveLength(1)
    expect(data.mostFrequent.data.map((row) => row.number)).toEqual([1, 12, 23])
    expect(data.leastFrequent.data.map((row) => row.number)).toEqual([2, 3, 4])
    expect(data.mostFrequent.meta.sort).toBe('most')
    expect(data.leastFrequent.meta.sort).toBe('least')

    const failingClient = createApiClient(
      '/api/v1',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({}, { status: 429, headers: { 'Retry-After': '30' } }),
        ),
    )
    rememberGamePage(
      'five',
      { ...data, capturedAt: '2026-01-01T00:00:00Z' },
      failingClient,
    )
    const fallback = await loadGameWithFallback(failingClient, 'five')

    expect(fallback.latest?.id).toBe(data.latest?.id)
    expect(fallback.refreshError).toBe(
      'Túl sok kérés. Kérjük, várjon az újrapróbálkozással.',
    )
    const again = await loadGameWithFallback(failingClient, 'five')
    expect(again.refreshError).toBe(fallback.refreshError)
    expect(again.capturedAt).toBe('2026-01-01T00:00:00Z')
  })
})
