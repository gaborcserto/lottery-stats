import { createApiClient } from './client'
import { loadGame, type GamePageData, type HomePageData } from './page-data'
import type { GameCode } from './contracts'
import { gameCodes } from '../config/games'

let snapshot: Promise<Record<GameCode, GamePageData>> | undefined

declare global {
  var lotteryDevelopmentSnapshot:
    Promise<Record<GameCode, GamePageData>> | undefined
}

function serverClient() {
  const configured = process.env.PRERENDER_API_BASE_URL
  if (!configured)
    throw new Error(
      'Prerender requires PRERENDER_API_BASE_URL pointing to the Laravel /api/v1 endpoint.',
    )
  const url = new URL(configured)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, '') !== '/api/v1'
  )
    throw new Error(
      'PRERENDER_API_BASE_URL must be an HTTP(S) URL ending in /api/v1 without credentials, query or fragment.',
    )
  return createApiClient(url.href)
}

class IncompleteSnapshotError extends Error {
  constructor(game: GameCode, sources: string[]) {
    super(`${game} game is missing required ${sources.join(', ')} data.`)
  }
}

function requireCompleteGameSnapshot(
  game: GameCode,
  data: GamePageData,
): GamePageData {
  const missing: string[] = []
  if (data.historyError) missing.push('history')
  if (data.pairsError || !data.pairs) missing.push('pairs')
  if (data.yearlyError || !data.yearly) missing.push('yearly statistics')
  if (missing.length) throw new IncompleteSnapshotError(game, missing)

  return data
}

async function acquireSnapshot(): Promise<Record<GameCode, GamePageData>> {
  try {
    const client = serverClient()
    const signal = AbortSignal.timeout(20_000)
    const games = await client.games(signal)
    if (
      games.data.length !== 3 ||
      gameCodes.some((code) => !games.data.some((game) => game.code === code))
    )
      throw new Error('Incomplete game list')
    // One release snapshot, shared by all route loaders. No automatic retries or feed access.
    const five = requireCompleteGameSnapshot(
      'five',
      await loadGame(client, 'five', signal),
    )
    const six = requireCompleteGameSnapshot(
      'six',
      await loadGame(client, 'six', signal),
    )
    const scandinavian = requireCompleteGameSnapshot(
      'scandinavian',
      await loadGame(client, 'scandinavian', signal),
    )
    const capturedAt = new Date().toISOString()
    return {
      five: { ...five, capturedAt },
      six: { ...six, capturedAt },
      scandinavian: { ...scandinavian, capturedAt },
    }
  } catch (error) {
    if (error instanceof IncompleteSnapshotError)
      throw new Error(`Prerender snapshot acquisition failed: ${error.message}`)
    throw new Error(
      'Prerender snapshot acquisition failed. Check PRERENDER_API_BASE_URL, Laravel availability, API contracts and rate limits; no release should be published.',
    )
  }
}

function getSnapshot() {
  // Vite reloads server modules during edits. Keep the shared acquisition across
  // those reloads so a small UI change cannot trigger overlapping API batches.
  if (import.meta.env.DEV) {
    globalThis.lotteryDevelopmentSnapshot ??= acquireSnapshot().catch(
      (error) => {
        globalThis.lotteryDevelopmentSnapshot = undefined
        throw error
      },
    )
    return globalThis.lotteryDevelopmentSnapshot
  }
  snapshot ??= acquireSnapshot().catch((error) => {
    snapshot = undefined
    throw error
  })
  return snapshot
}

export async function gameSnapshot(game: GameCode) {
  return (await getSnapshot())[game]
}

export async function homeSnapshot(): Promise<HomePageData> {
  const data = await getSnapshot()
  return {
    latest: gameCodes.map((game) => ({ game, drawing: data[game].latest })),
    capturedAt: data.five.capturedAt,
  }
}
