import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'
import { loadGame, loadGameWithFallback, rememberGamePage } from './page-data'
import { fixtureResponses } from '../test/fixtures'

describe('game page data loading', () => {
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

    rememberGamePage('five', data)
    const failingClient = createApiClient(
      '/api/v1',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({}, { status: 429, headers: { 'Retry-After': '30' } }),
        ),
    )
    const fallback = await loadGameWithFallback(failingClient, 'five')

    expect(fallback.latest?.id).toBe(data.latest?.id)
    expect(fallback.refreshError).toBe(
      'Túl sok kérés. Kérjük, várjon az újrapróbálkozással.',
    )
  })
})
