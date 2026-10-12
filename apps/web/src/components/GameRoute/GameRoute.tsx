import { useEffect, useRef } from 'react'
import { useRevalidator, useLocation } from 'react-router'
import type { GameCode } from '../../api/contracts'
import { rememberGamePage, type GamePageData } from '../../api/page-data'
import { GamePage } from '../../pages/GamePage'

export function GameRoute({
  game,
  data,
}: {
  game: GameCode
  data: GamePageData
}) {
  const { revalidate, state } = useRevalidator()
  const refreshed = useRef(false)
  const { search } = useLocation()

  useEffect(() => {
    rememberGamePage(game, data)
    if (refreshed.current) return
    refreshed.current = true
    if (search) return
    // Hydration uses the release snapshot. Revalidate afterward while keeping it visible.
    void revalidate()
  }, [game, data, revalidate, search])

  return <GamePage game={game} data={data} refreshing={state === 'loading'} />
}
