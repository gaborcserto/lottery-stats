import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient, parseRetryAfter } from './client'
import { decodeDrawing, decodeYearlyResponse } from './contracts'
import { fixtureGames, fixtureResponses } from '../test/fixtures'

const fixtures = fixtureResponses('five')
function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
afterEach(() => vi.useRealTimers())

describe('Laravel API client', () => {
  it('maps all ten endpoints to the public paths and validates their contracts', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const client = createApiClient('/api/v1', fetcher)
    const calls = [
      [fixtureGames, () => client.games(), '/games'],
      [fixtures.game, () => client.game('five'), '/games/five'],
      [
        fixtures.history,
        () => client.drawings('five', { year: 2026, page: 2 }),
        '/games/five/drawings?year=2026&page=2',
      ],
      [
        fixtures.drawing,
        () => client.latest('five'),
        '/games/five/drawings/latest',
      ],
      [
        fixtures.drawing,
        () => client.drawing('five', 7),
        '/games/five/drawings/7',
      ],
      [
        fixtures.summary,
        () => client.summary('five', { set: 'main' }),
        '/games/five/statistics/summary?set=main',
      ],
      [
        fixtures.frequencies,
        () => client.frequencies('five', { sort: 'number', limit: 90 }),
        '/games/five/statistics/frequencies?sort=number&limit=90',
      ],
      [
        fixtures.parity,
        () => client.parity('five'),
        '/games/five/statistics/parity',
      ],
      [
        fixtures.pairs,
        () => client.pairs('five', { limit: 20 }),
        '/games/five/statistics/pairs?limit=20',
      ],
      [
        fixtures.yearly,
        () => client.yearly('five'),
        '/games/five/statistics/trends/yearly',
      ],
    ] as const
    for (const [body, call, path] of calls) {
      fetcher.mockResolvedValueOnce(json(body))
      await expect(call()).resolves.toHaveProperty('data')
      expect(fetcher).toHaveBeenLastCalledWith(`/api/v1${path}`, {
        headers: { Accept: 'application/json' },
        signal: undefined,
      })
    }
  })
  it('preserves exact prize strings and required nulls', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json(fixtures.drawing))
    const result = await createApiClient('/api/v1', fetcher).latest('five')
    expect(result.data.prizes[0].amount).toBe('9007199254740993.25')
    expect(
      decodeDrawing({
        ...fixtures.drawing.data,
        drawn_on: null,
        prizes: [
          { tier: 'match_5', winner_count: null, amount: null, currency: null },
        ],
      }).drawn_on,
    ).toBeNull()
  })
  it.each([
    { data: { ...fixtures.drawing.data, drawn_on: undefined } },
    { data: { ...fixtures.drawing.data, drawn_on: '2026-02-30' } },
    { data: { ...fixtures.drawing.data, week: 54 } },
    {
      data: {
        ...fixtures.drawing.data,
        sets: [{ type: 'main', numbers: [1, 1] }],
      },
    },
    {
      data: {
        ...fixtures.drawing.data,
        prizes: [
          { tier: 'match_5', winner_count: 1, amount: 123.45, currency: 'HUF' },
        ],
      },
    },
  ])('rejects malformed drawing payloads', async (body) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(body))
    await expect(
      createApiClient('/api/v1', fetcher).latest('five'),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it('rejects invalid statistical metadata and optional selected-number fields', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        ...fixtures.frequencies,
        meta: {
          ...fixtures.frequencies.meta,
          occurrence_percentage_denominator: 'wrong',
        },
      }),
    )
    await expect(
      createApiClient('/api/v1', fetcher).frequencies('five'),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
    expect(() =>
      decodeYearlyResponse({
        ...fixtures.yearly,
        meta: { ...fixtures.yearly.meta, selected_number: 1 },
      }),
    ).toThrow()
  })
  it.each([
    [404, 'not-found'],
    [422, 'validation'],
    [500, 'server'],
    [503, 'server'],
    [403, 'http'],
  ])('handles HTTP %i without exposing raw errors', async (status, kind) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json(
        {
          message: 'private Laravel database path',
          errors: { year: ['internal error'], secret: ['hidden'] },
        },
        Number(status),
      ),
    )
    try {
      await createApiClient('/api/v1', fetcher).games()
      expect.fail('Expected rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ kind, status })
      expect(String(error)).not.toContain('private')
      if (status === 422) expect(error).toHaveProperty('fields', ['year'])
    }
  })
  it('handles network, non-JSON, and invalid JSON failures', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('private host'))
      .mockResolvedValueOnce(new Response('<html/>'))
      .mockResolvedValueOnce(
        new Response('{', { headers: { 'Content-Type': 'application/json' } }),
      )
    const client = createApiClient('/api/v1', fetcher)
    await expect(client.games()).rejects.toMatchObject({ kind: 'network' })
    await expect(client.games()).rejects.toMatchObject({
      kind: 'invalid-response',
    })
    await expect(client.games()).rejects.toMatchObject({
      kind: 'invalid-response',
    })
  })
  it('propagates AbortSignal and preserves cancellation', async () => {
    const controller = new AbortController()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) =>
            options?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            ),
          ),
      )
    const client = createApiClient('/api/v1', fetcher)
    const result = client.games(controller.signal)
    controller.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher.mock.calls[0][1]?.signal).toBe(controller.signal)
    await expect(client.games(controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('honors Retry-After across requests without automatic retries', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'))
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 429, { 'Retry-After': '30' }))
      .mockResolvedValueOnce(json(fixtureGames))
    const client = createApiClient('/api/v1', fetcher)
    const retryAt = Date.now() + 30_000
    await expect(client.games()).rejects.toMatchObject({
      kind: 'rate-limit',
      retryAt,
    })
    await expect(client.games()).rejects.toMatchObject({
      kind: 'rate-limit',
      retryAt,
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30_000)
    await expect(client.games()).resolves.toEqual(fixtureGames)
  })
  it('supports HTTP-date Retry-After and rejects invalid headers', () => {
    expect(
      parseRetryAfter(
        'Sat, 10 Oct 2026 12:01:00 GMT',
        Date.parse('2026-10-10T12:00:00Z'),
      ),
    ).toBe(Date.parse('2026-10-10T12:01:00Z'))
    expect(parseRetryAfter('nonsense')).toBeUndefined()
    expect(parseRetryAfter(null)).toBeUndefined()
  })
})
