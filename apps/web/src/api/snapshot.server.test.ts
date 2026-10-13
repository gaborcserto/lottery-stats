import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fixtureGames,
  fixturePageData,
  fixtureResponses,
} from '../test/fixtures'

beforeEach(() => {
  delete globalThis.lotteryDevelopmentSnapshot
  vi.resetModules()
  vi.stubEnv('DEV', true)
  vi.stubEnv('PRERENDER_API_BASE_URL', 'http://fixture.test/api/v1')
})
afterEach(() => {
  delete globalThis.lotteryDevelopmentSnapshot
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function snapshotFetcher() {
  return vi.fn<typeof fetch>(async (input) => snapshotFetcherResponse(input))
}

async function snapshotFetcherResponse(input: unknown) {
  const url = String(input)
  if (url.endsWith('/games')) return Response.json(fixtureGames)
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
}

describe('development snapshot acquisition', () => {
  it('shares pending and completed acquisitions across server module reloads', async () => {
    const fetcher = snapshotFetcher()
    vi.stubGlobal('fetch', fetcher)
    const firstModule = await import('./snapshot.server')
    const first = firstModule.homeSnapshot()
    vi.resetModules()
    const secondModule = await import('./snapshot.server')
    const second = secondModule.gameSnapshot('six')
    const [home, game] = await Promise.all([first, second])
    expect(home.capturedAt).toBe(game.capturedAt)
    expect(game.yearly?.meta.selected_number).toBe(1)
    expect(game.pairs?.data).toEqual(fixtureResponses('six').pairs.data)
    expect(fetcher).toHaveBeenCalledTimes(22)
    vi.resetModules()
    const thirdModule = await import('./snapshot.server')
    expect(await thirdModule.homeSnapshot()).toEqual(home)
    expect(fetcher).toHaveBeenCalledTimes(22)
  })

  it.each([
    ['history', '/drawings?'],
    ['pairs', '/statistics/pairs'],
    ['yearly statistics', '/statistics/trends/yearly'],
  ])('rejects a snapshot when required %s data fails', async (source, path) => {
    const fetcher = snapshotFetcher()
    fetcher.mockImplementation(async (input) =>
      String(input).includes(`/games/five${path}`)
        ? Response.json({}, { status: 503 })
        : snapshotFetcherResponse(input),
    )
    vi.stubGlobal('fetch', fetcher)
    const snapshot = await import('./snapshot.server')

    await expect(snapshot.gameSnapshot('five')).rejects.toThrow(
      `Prerender snapshot acquisition failed: five game is missing required ${source} data.`,
    )
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).includes(`/games/five${path}`),
      ),
    ).toHaveLength(1)
  })

  it('accepts valid empty history, pairs and yearly datasets', async () => {
    const fetcher = snapshotFetcher()
    const original = fetcher.getMockImplementation()
    if (!original) throw new Error('Expected snapshot fixture fetcher.')
    fetcher.mockImplementation(async (input, init) => {
      const response = await original(input, init)
      const url = new URL(String(input))
      if (
        !url.pathname.endsWith('/drawings') &&
        !url.pathname.endsWith('/statistics/pairs') &&
        !url.pathname.endsWith('/statistics/trends/yearly')
      )
        return response

      const body = await response.json()
      body.data = []
      if (url.pathname.endsWith('/drawings')) {
        body.meta.from = null
        body.meta.to = null
        body.meta.total = 0
      }
      return Response.json(body)
    })
    vi.stubGlobal('fetch', fetcher)
    const snapshot = await import('./snapshot.server')

    const game = await snapshot.gameSnapshot('five')
    expect(game.history).toEqual([])
    expect(game.historyError).toBeNull()
    expect(game.pairs?.data).toEqual([])
    expect(game.yearly?.data).toEqual([])
  })

  it('allows a later acquisition after failure without exposing internal details', async () => {
    const fetcher = snapshotFetcher()
    fetcher.mockResolvedValueOnce(Response.json({}, { status: 503 }))
    vi.stubGlobal('fetch', fetcher)
    const snapshot = await import('./snapshot.server')
    await expect(snapshot.homeSnapshot()).rejects.toThrow(
      'Prerender snapshot acquisition failed.',
    )
    expect(globalThis.lotteryDevelopmentSnapshot).toBeUndefined()
    expect((await snapshot.homeSnapshot()).latest).toHaveLength(3)
    expect(fetcher).toHaveBeenCalledTimes(23)
  })
})
