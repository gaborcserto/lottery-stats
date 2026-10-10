import { ApiError, api, type ApiClient } from './client'
import type { Drawing, GameCode } from './contracts'
import { gameCodes } from '../config/games'

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
  }
>()

function cacheFor(client: ApiClient) {
  let cache = caches.get(client)
  if (!cache) {
    cache = { pages: new Map(), latest: new Map() }
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
    if (!cache.latest.has(game)) cache.latest.set(game, { drawing, capturedAt })
  }
}

export async function loadGameRoute(
  client: ApiClient,
  game: GameCode,
  snapshot: () => Promise<GamePageData>,
  signal: AbortSignal,
): Promise<GamePageData> {
  signal.throwIfAborted()
  if (!cacheFor(client).pages.has(game)) {
    // Native prerender data gives a first visit content without waiting for live statistics.
    const data = await snapshot()
    signal.throwIfAborted()
    rememberGamePage(game, data, client)
    return data
  }
  return loadGameWithFallback(client, game, signal)
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
    const data = await loadGame(client, game, signal)
    const result =
      data.historyError && cached ? { ...data, history: cached.history } : data
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
): Promise<GamePageData> {
  const set = game === 'scandinavian' ? 'machine' : 'main'
  const latestRequest = loadLatest(client, game, signal)
  const [latest, summary, frequencies, parity, recent] = await Promise.all([
    latestRequest,
    client.summary(game, { set }, signal),
    client.frequencies(game, { set, sort: 'number' }, signal),
    client.parity(game, { set }, signal),
    loadHistory(client, game, latestRequest, signal),
  ])
  const mostFrequent = {
    data: frequencies.data
      .slice()
      .sort(
        (first, second) =>
          second.count - first.count || first.number - second.number,
      )
      .slice(0, 3),
    meta: { ...frequencies.meta, sort: 'most' as const, limit: 3 },
  }
  const leastFrequent = {
    data: frequencies.data
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
    ...recent,
    capturedAt: new Date().toISOString(),
  }
}

async function loadHistory(
  client: ApiClient,
  game: GameCode,
  latestRequest: Promise<Drawing | null>,
  signal?: AbortSignal,
): Promise<Pick<GamePageData, 'history' | 'historyError'>> {
  try {
    const [page, latest] = await Promise.all([
      client.drawings(game, { per_page: 5 }, signal),
      latestRequest,
    ])
    const details = new Map(
      await Promise.all(
        page.data
          .filter((item) => item.id !== latest?.id)
          .map(
            async (item) =>
              [
                item.id,
                (await client.drawing(game, item.id, signal)).data,
              ] as const,
          ),
      ),
    )
    const history = page.data.flatMap((item) => {
      const drawing = item.id === latest?.id ? latest : details.get(item.id)
      return drawing ? [drawing] : []
    })
    return { history, historyError: null }
  } catch (error) {
    signal?.throwIfAborted()
    if (!(error instanceof ApiError)) throw error
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
