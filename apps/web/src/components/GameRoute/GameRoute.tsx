import { useEffect } from 'react'
import { useLocation } from 'react-router'
import type { GameCode } from '../../api/contracts'
import {
  invalidateGameRefresh,
  loadGameWithFallback,
  rememberGamePage,
  type GamePageData,
} from '../../api/page-data'
import { api } from '../../api/client'
import { useResource } from '../../api/use-resource'
import { parseFilters } from '../../api/filters'
import { GamePage } from '../../pages/GamePage'

function refreshGame(game: string, signal: AbortSignal) {
  if (game !== 'five' && game !== 'six' && game !== 'scandinavian')
    throw new Error('Invalid game')
  return loadGameWithFallback(api, game, signal)
}
refreshGame.invalidate = (game: string) => {
  if (game === 'five' || game === 'six' || game === 'scandinavian')
    invalidateGameRefresh(game)
}

export function GameRoute({
  game,
  data,
}: {
  game: GameCode
  data: GamePageData
}) {
  const { search } = useLocation()
  const filters = parseFilters(new URLSearchParams(search), game)
  const isFiltered =
    Object.keys(filters.population).length > 0 ||
    filters.statistics.set === 'manual' ||
    filters.statistics.set === 'combined'

  useEffect(() => {
    rememberGamePage(game, data)
  }, [game, data])
  // Navigation commits cached/prerendered content before requesting live data.
  // Filtered pages own their refresh; don't fetch default statistics as well.
  const refresh = useResource(isFiltered ? null : game, refreshGame)
  const retained = refresh.data ?? refresh.previousData
  const current = retained?.summary.meta.game === game ? retained : data

  return (
    <>
      {(current.refreshError || refresh.error) && !isFiltered && (
        <button type="button" onClick={refresh.retry}>
          Újrapróbálkozás
        </button>
      )}
      {refresh.error && <p role="alert">{refresh.error}</p>}
      <GamePage game={game} data={current} refreshing={refresh.loading} />
    </>
  )
}
