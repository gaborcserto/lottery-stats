import type { Route } from './+types/home'
import { useLoaderData } from 'react-router'
import { homeSnapshot } from '../api/snapshot.server'
import { HomePage } from '../pages/HomePage'
import { homePageMeta } from '../config/seo'
export { RouteError as ErrorBoundary } from '../components/RouteError'

export function meta({ location }: Route.MetaArgs) {
  return homePageMeta(location.pathname)
}

export async function loader(_args: Route.LoaderArgs) {
  void _args
  return homeSnapshot()
}

export default function Home() {
  return <HomePage data={useLoaderData<typeof loader>()} />
}
