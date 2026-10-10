import type { Route } from './+types/scandinavian'
import { useLoaderData } from 'react-router'
import { gameSnapshot } from '../api/snapshot.server'
import { api } from '../api/client'
import { loadGameWithFallback } from '../api/page-data'
import { gameMeta } from '../config/games'
import { GamePage } from '../pages/GamePage'
export { RouteError as ErrorBoundary } from '../components/RouteError'

export function meta() {
  return gameMeta('scandinavian')
}
export async function loader() {
  return gameSnapshot('scandinavian')
}
export async function clientLoader({
  request,
}: Pick<Route.ClientLoaderArgs, 'request'>) {
  return loadGameWithFallback(api, 'scandinavian', request.signal)
}
export default function Scandinavian() {
  return <GamePage game="scandinavian" data={useLoaderData<typeof loader>()} />
}
