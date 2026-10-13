import { ApiError, api, type ApiClient } from './client'
import type {
  Drawing,
  GameCode,
  PopulationFilters,
  SetScope,
} from './contracts'
import { gameCodes } from '../config/games'
import { cachedResource } from './resource'
import { parseFilters } from './filters'

export interface GamePageData {
  latest: Drawing | null
  summary: Awaited<ReturnType<ApiClient['summary']>>
  frequencies: Awaited<ReturnType<ApiClient['frequencies']>>
  mostFrequent: Awaited<ReturnType<ApiClient['frequencies']>>
  leastFrequent: Awaited<ReturnType<ApiClient['frequencies']>>
  parity: Awaited<ReturnType<ApiClient['parity']>>
  history: Drawing[]
  historyError: string | null
  refreshError?: string | null
  capturedAt: string
  historyPage?: { current: number; last: number; total: number }
  pairs?: Awaited<ReturnType<ApiClient['pairs']>>
  yearly?: Awaited<ReturnType<ApiClient['yearly']>>
  pairsError?: string
  yearlyError?: string
}
export interface HomePageData {
  latest: { game: GameCode; drawing: Drawing | null }[]
  capturedAt: string
}

const freshnessMs = 30_000
const caches = new WeakMap<
  ApiClient,
  {
    pages: Map<GameCode, GamePageData>
    latest: Map<GameCode, { drawing: Drawing | null; capturedAt: string }>
    refresh: ReturnType<typeof cachedResource<GamePageData>>
    history: ReturnType<
      typeof cachedResource<Awaited<ReturnType<ApiClient['drawingHistory']>>>
    >
  }
>()

function cacheFor(client: ApiClient) {
  let cache = caches.get(client)
  if (!cache) {
    cache = {
      pages: new Map(),
      latest: new Map(),
      refresh: cachedResource((game, signal) => {
        if (game !== 'five' && game !== 'six' && game !== 'scandinavian')
          throw new Error('Invalid game')
        return loadGame(client, game, signal)
      }),
      history: cachedResource((key, signal) => {
        const [game, query] = key.split('?')
        if (game !== 'five' && game !== 'six' && game !== 'scandinavian')
          throw new Error('Invalid game')
        const filters = parseFilters(new URLSearchParams(query), game)
        return client.drawingHistory(
          game,
          {
            ...filters.population,
            per_page: 5,
            ...(filters.page === 1 ? {} : { page: filters.page }),
          },
          signal,
        )
      }),
    }
    caches.set(client, cache)
  }
  return cache
}

function isFresh(capturedAt: string) {
  const age = Date.now() - Date.parse(capturedAt)
  return age >= 0 && age < freshnessMs
}

export function rememberGamePage(
  game: GameCode,
  data: GamePageData,
  client: ApiClient = api,
) {
  const cache = cacheFor(client)
  cache.pages.set(game, data)
  // A failed refresh must not extend the freshness of earlier results.
  if (!data.refreshError && !cache.latest.has(game))
    cache.latest.set(game, {
      drawing: data.latest,
      capturedAt: data.capturedAt,
    })
}

export function rememberHomeData(data: HomePageData, client: ApiClient = api) {
  const cache = cacheFor(client)
  const capturedAt = new Date().toISOString()
  for (const { game, drawing } of data.latest) {
    if (!cache.latest.has(game)) {
      cache.latest.set(game, { drawing, capturedAt })
    }
  }
}

export async function loadGameRoute(
  client: ApiClient,
  game: GameCode,
  snapshot: () => Promise<GamePageData>,
  signal: AbortSignal,
): Promise<GamePageData> {
  signal.throwIfAborted()
  const cached = cacheFor(client).pages.get(game)
  if (!cached) {
    // Native prerender data gives a first visit content without waiting for live statistics.
    const data = await snapshot()
    signal.throwIfAborted()
    rememberGamePage(game, data, client)
    return data
  }
  return cached
}

export function invalidateGameRefresh(game: GameCode, client: ApiClient = api) {
  cacheFor(client).refresh.invalidate(game)
}

export async function loadGameWithFallback(
  client: ApiClient,
  game: GameCode,
  signal?: AbortSignal,
): Promise<GamePageData> {
  signal?.throwIfAborted()
  const cached = cacheFor(client).pages.get(game)
  if (cached && !cached.refreshError && isFresh(cached.capturedAt))
    return cached
  try {
    const data = await cacheFor(client).refresh(
      game,
      signal ?? new AbortController().signal,
    )
    const result = cached
      ? {
          ...data,
          ...(data.historyError
            ? { history: cached.history, historyPage: cached.historyPage }
            : {}),
          ...(data.pairsError ? { pairs: cached.pairs } : {}),
          ...(data.yearlyError ? { yearly: cached.yearly } : {}),
        }
      : data
    rememberGamePage(game, result, client)
    return result
  } catch (error) {
    signal?.throwIfAborted()
    if (cached && error instanceof ApiError) {
      return { ...cached, refreshError: error.message }
    }
    throw error
  }
}

export async function loadLatest(
  client: ApiClient,
  game: GameCode,
  signal?: AbortSignal,
): Promise<Drawing | null> {
  signal?.throwIfAborted()
  const cache = cacheFor(client)
  const cached = cache.latest.get(game)
  if (cached && isFresh(cached.capturedAt)) return cached.drawing
  try {
    const drawing = (await client.latest(game, signal)).data
    cache.latest.set(game, { drawing, capturedAt: new Date().toISOString() })
    return drawing
  } catch (error) {
    if (error instanceof ApiError && error.kind === 'not-found') return null
    throw error
  }
}
export async function loadGame(
  client: ApiClient,
  game: GameCode,
  signal?: AbortSignal,
  filters: PopulationFilters = {},
  scope?: SetScope,
  historyPage = 1,
): Promise<GamePageData> {
  const set = scope ?? (game === 'scandinavian' ? 'machine' : 'main')
  const latestRequest = loadLatest(client, game, signal)
  const chartRequests = Promise.allSettled([
    client
      .pairs(game, { ...filters, set, limit: 10 }, signal)
      .then((result) => {
        if (result.meta.game !== game || result.meta.set_scope !== set)
          throw new ApiError('invalid-response')
        return result
      }),
    client
      .yearly(game, { ...filters, set, number: 1 }, signal)
      .then((result) => {
        if (
          result.meta.game !== game ||
          result.meta.set_scope !== set ||
          result.meta.selected_number !== 1
        )
          throw new ApiError('invalid-response')
        return result
      }),
  ])
  const [latest, summary, frequencies, parity, recent] = await Promise.all([
    latestRequest,
    client.summary(game, { ...filters, set }, signal),
    client.frequencies(game, { ...filters, set, sort: 'number' }, signal),
    client.parity(game, { ...filters, set }, signal),
    loadHistory(client, game, latestRequest, signal, filters, historyPage),
  ])
  const [pairs, yearly] = await chartRequests
  signal?.throwIfAborted()
  const mostFrequent = {
    data:
      frequencies.meta.eligible_set_count === 0
        ? []
        : frequencies.data
            .slice()
            .sort(
              (first, second) =>
                second.count - first.count || first.number - second.number,
            )
            .slice(0, 3),
    meta: { ...frequencies.meta, sort: 'most' as const, limit: 3 },
  }
  const leastFrequent = {
    data:
      frequencies.meta.eligible_set_count === 0
        ? []
        : frequencies.data
            .slice()
            .sort(
              (first, second) =>
                first.count - second.count || first.number - second.number,
            )
            .slice(0, 3),
    meta: { ...frequencies.meta, sort: 'least' as const, limit: 3 },
  }
  if (
    summary.meta.game !== game ||
    frequencies.meta.game !== game ||
    mostFrequent.meta.game !== game ||
    leastFrequent.meta.game !== game ||
    summary.meta.set_scope !== set ||
    frequencies.meta.set_scope !== set ||
    mostFrequent.meta.set_scope !== set ||
    leastFrequent.meta.set_scope !== set ||
    frequencies.meta.sort !== 'number' ||
    mostFrequent.meta.sort !== 'most' ||
    leastFrequent.meta.sort !== 'least' ||
    parity.meta.set_scope !== set ||
    parity.meta.game !== game
  )
    throw new ApiError('invalid-response')
  return {
    latest,
    summary,
    frequencies,
    mostFrequent,
    leastFrequent,
    parity,
    ...(pairs.status === 'fulfilled'
      ? { pairs: pairs.value }
      : {
          pairsError:
            pairs.reason instanceof ApiError
              ? pairs.reason.message
              : 'A számpárok nem érhetők el.',
        }),
    ...(yearly.status === 'fulfilled'
      ? { yearly: yearly.value }
      : {
          yearlyError:
            yearly.reason instanceof ApiError
              ? yearly.reason.message
              : 'Az éves adatok nem érhetők el.',
        }),
    ...recent,
    capturedAt: new Date().toISOString(),
  }
}

export async function loadHistory(
  client: ApiClient,
  game: GameCode,
  latestRequest: Promise<Drawing | null>,
  signal?: AbortSignal,
  filters: PopulationFilters = {},
  historyPage = 1,
  { throwOnError = false }: { throwOnError?: boolean } = {},
): Promise<Pick<GamePageData, 'history' | 'historyError' | 'historyPage'>> {
  try {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(filters))
      if (value !== undefined) query.set(key, String(value))
    query.set('page', String(historyPage))
    const [page, latest] = await Promise.all([
      cacheFor(client).history(
        `${game}?${query}`,
        signal ?? new AbortController().signal,
      ),
      latestRequest,
    ])
    // The paginated details response replaces the list-plus-N-detail waterfall.
    signal?.throwIfAborted()
    const history = page.data.map((drawing) =>
      drawing.id === latest?.id ? latest : drawing,
    )
    return {
      history,
      historyError: null,
      historyPage: {
        current: page.meta.current_page,
        last: page.meta.last_page,
        total: page.meta.total,
      },
    }
  } catch (error) {
    signal?.throwIfAborted()
    if (throwOnError || !(error instanceof ApiError)) throw error
    return { history: [], historyError: error.message }
  }
}
export async function loadHome(
  client: ApiClient = api,
  signal?: AbortSignal,
): Promise<HomePageData> {
  const latest = await Promise.all(
    gameCodes.map(async (game) => ({
      game,
      drawing: await loadLatest(client, game, signal),
    })),
  )
  return { latest, capturedAt: new Date().toISOString() }
}
