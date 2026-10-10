import type { Route } from './+types/six'
import { useLoaderData } from 'react-router'
import { gameSnapshot } from '../api/snapshot.server'
import { api } from '../api/client'
import { loadGameRoute } from '../api/page-data'
import { gameMeta } from '../config/games'
import { GameRoute } from '../components/GameRoute'
export { RouteError as ErrorBoundary } from '../components/RouteError'

export function meta() {
  return gameMeta('six')
}
export async function loader() {
  return gameSnapshot('six')
}
export async function clientLoader({
  request,
  serverLoader,
}: Pick<Route.ClientLoaderArgs, 'request' | 'serverLoader'>) {
  return loadGameRoute(api, 'six', serverLoader, request.signal)
}
export default function Six() {
  return <GameRoute game="six" data={useLoaderData<typeof loader>()} />
}
