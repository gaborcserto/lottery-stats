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

const gamePageCache = new Map<GameCode, GamePageData>()

export function rememberGamePage(game: GameCode, data: GamePageData) {
  gamePageCache.set(game, data)
}

export async function loadGameWithFallback(
  client: ApiClient,
  game: GameCode,
  signal?: AbortSignal,
): Promise<GamePageData> {
  try {
    const data = await loadGame(client, game, signal)
    rememberGamePage(game, data)
    return data
  } catch (error) {
    const cached = gamePageCache.get(game)
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
  try {
    return (await client.latest(game, signal)).data
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
  const [latest, summary, frequencies, parity] = await Promise.all([
    loadLatest(client, game, signal),
    client.summary(game, { set }, signal),
    client.frequencies(game, { set, sort: 'number' }, signal),
    client.parity(game, { set }, signal),
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
    parity.meta.set_scope !== set
  )
    throw new ApiError('invalid-response')
  let history: Drawing[] = []
  let historyError: string | null = null
  try {
    const page = await client.drawings(game, { per_page: 5 }, signal)
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
    history = page.data.flatMap((item) => {
      const drawing = item.id === latest?.id ? latest : details.get(item.id)
      return drawing ? [drawing] : []
    })
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    historyError = error.message
  }
  return {
    latest,
    summary,
    frequencies,
    mostFrequent,
    leastFrequent,
    parity,
    history,
    historyError,
    capturedAt: new Date().toISOString(),
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
