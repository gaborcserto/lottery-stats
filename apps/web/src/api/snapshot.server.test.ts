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
  return vi.fn<typeof fetch>(async (input) => {
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
  })
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
