import type { Route } from './+types/five'
import { useLoaderData } from 'react-router'
import { gameSnapshot } from '../api/snapshot.server'
import { api } from '../api/client'
import { loadGame } from '../api/page-data'
import { gameMeta } from '../config/games'
import { GamePage } from '../pages/GamePage'
export { RouteError as ErrorBoundary } from '../components/RouteError'

export function meta() {
  return gameMeta('five')
}
export async function loader() {
  return gameSnapshot('five')
}
export async function clientLoader({
  request,
}: Pick<Route.ClientLoaderArgs, 'request'>) {
  return loadGame(api, 'five', request.signal)
}
export default function Five() {
  return <GamePage game="five" data={useLoaderData<typeof loader>()} />
}
