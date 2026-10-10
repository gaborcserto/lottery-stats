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
  capturedAt: string
}
export interface HomePageData {
  latest: { game: GameCode; drawing: Drawing | null }[]
  capturedAt: string
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
  const [latest, summary, frequencies, mostFrequent, leastFrequent, parity] =
    await Promise.all([
      loadLatest(client, game, signal),
      client.summary(game, { set }, signal),
      client.frequencies(game, { set, sort: 'number' }, signal),
      client.frequencies(game, { set, sort: 'most', limit: 3 }, signal),
      client.frequencies(game, { set, sort: 'least', limit: 3 }, signal),
      client.parity(game, { set }, signal),
    ])
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
