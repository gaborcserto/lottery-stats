import { ApiError, api, type ApiClient } from './client'
import type { Drawing, GameCode } from './contracts'
import { gameCodes } from '../config/games'

export interface GamePageData {
  latest: Drawing | null
  summary: Awaited<ReturnType<ApiClient['summary']>>
  frequencies: Awaited<ReturnType<ApiClient['frequencies']>>
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
  const [latest, summary, frequencies] = await Promise.all([
    loadLatest(client, game, signal),
    client.summary(game, { set }, signal),
    client.frequencies(game, { set, sort: 'number' }, signal),
  ])
  if (
    summary.meta.game !== game ||
    frequencies.meta.game !== game ||
    summary.meta.set_scope !== set ||
    frequencies.meta.set_scope !== set ||
    (latest === null && summary.data.drawing_count > 0)
  )
    throw new ApiError('invalid-response')
  return { latest, summary, frequencies, capturedAt: new Date().toISOString() }
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
