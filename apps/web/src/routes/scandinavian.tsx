import type { Route } from './+types/scandinavian'
import { useLoaderData, type ShouldRevalidateFunctionArgs } from 'react-router'
import { gameSnapshot } from '../api/snapshot.server'
import { api } from '../api/client'
import { loadGameRoute } from '../api/page-data'
import { gameMeta } from '../config/games'
import { GameRoute } from '../components/GameRoute'
export { RouteError as ErrorBoundary } from '../components/RouteError'

export function meta() {
  return gameMeta('scandinavian')
}
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search
    ? false
    : defaultShouldRevalidate
}
export async function loader() {
  return gameSnapshot('scandinavian')
}
export async function clientLoader({
  request,
  serverLoader,
}: Pick<Route.ClientLoaderArgs, 'request' | 'serverLoader'>) {
  return loadGameRoute(api, 'scandinavian', serverLoader, request.signal)
}
export default function Scandinavian() {
  return <GameRoute game="scandinavian" data={useLoaderData<typeof loader>()} />
}
