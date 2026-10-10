import type { Route } from './+types/home'
import { useLoaderData } from 'react-router'
import { homeSnapshot } from '../api/snapshot.server'
import { HomePage } from '../pages/HomePage'
export { RouteError as ErrorBoundary } from '../components/RouteError'

export function meta() {
  return [
    { title: 'Lottóeredmények és statisztikák | Lottery Stats' },
    {
      name: 'description',
      content:
        'Ötöslottó, Hatoslottó és Skandináv lottó: legutóbbi nyerőszámok és történelmi statisztikák a hivatalos sorsolási adatokból.',
    },
  ]
}
export async function loader(_args: Route.LoaderArgs) {
  void _args
  return homeSnapshot()
}
export default function Home() {
  return <HomePage data={useLoaderData<typeof loader>()} />
}
