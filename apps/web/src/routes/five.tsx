import type { Route } from './+types/five'
import { useLoaderData } from 'react-router'
import { gameSnapshot } from '../api/snapshot.server'
import { api } from '../api/client'
import { loadGameRoute } from '../api/page-data'
import { gameMeta } from '../config/games'
import { GameRoute } from '../components/GameRoute'
export { RouteError as ErrorBoundary } from '../components/RouteError'

export function meta() {
  return gameMeta('five')
}
export async function loader() {
  return gameSnapshot('five')
}
export async function clientLoader({
  request,
  serverLoader,
}: Pick<Route.ClientLoaderArgs, 'request' | 'serverLoader'>) {
  return loadGameRoute(api, 'five', serverLoader, request.signal)
}
export default function Five() {
  return <GameRoute game="five" data={useLoaderData<typeof loader>()} />
}
