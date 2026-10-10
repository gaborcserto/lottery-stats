import type { Route } from './+types/six'
import { useLoaderData } from 'react-router'
import { gameSnapshot } from '../api/snapshot.server'
import { api } from '../api/client'
import { loadGame } from '../api/page-data'
import { gameMeta } from '../config/games'
import { GamePage } from '../pages/GamePage'
export { RouteError as ErrorBoundary } from '../components/RouteError'

export function meta() {
  return gameMeta('six')
}
export async function loader() {
  return gameSnapshot('six')
}
export async function clientLoader({
  request,
}: Pick<Route.ClientLoaderArgs, 'request'>) {
  return loadGame(api, 'six', request.signal)
}
export default function Six() {
  return <GamePage game="six" data={useLoaderData<typeof loader>()} />
}
