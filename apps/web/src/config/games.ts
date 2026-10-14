import type { GameCode } from '../api/contracts'
import { pageMeta } from './seo'
import publicRoutes from './public-routes.json'

const gameRoutePaths = Object.fromEntries(
  publicRoutes
    .filter(({ path }) => path !== '/')
    .map(({ path, file }) => [file, path]),
)

export const gamePages = {
  five: {
    path: gameRoutePaths.five,
    logo: '/images/logos/otoslotto.png',
    name: 'Ötöslottó',
    description:
      'Korábbi Ötöslottó-sorsolások nyerőszámai és gyakorisági statisztikái, áttekinthetően.',
    introduction:
      'Az Ötöslottó sorsolásain öt főszámot húznak ki az 1 és 90 közötti számokból.',
  },
  six: {
    path: gameRoutePaths.six,
    logo: '/images/logos/hatoslotto.png',
    name: 'Hatoslottó',
    description:
      'Hatoslottó-eredmények és történelmi statisztikák, a korábbi pótszámok külön bemutatásával.',
    introduction:
      'A Hatoslottó hat főszámot használ az 1 és 45 közötti tartományból. A történelmi pótszámok külön szerepelnek, és nem részei a főszámok statisztikáinak.',
  },
  scandinavian: {
    path: gameRoutePaths.scandinavian,
    logo: '/images/logos/skandinav-lotto.png',
    name: 'Skandináv lottó',
    description:
      'Skandináv lottó-eredmények a gépi és kézi számsorokkal, valamint történelmi statisztikákkal.',
    introduction:
      'A Skandináv lottóban hét számot húznak ki az 1 és 35 közötti számokból. A gépi és a kézi számsort külön őrizzük meg; az alapstatisztikák a gépi számsorokra vonatkoznak.',
  },
} satisfies Record<
  GameCode,
  {
    path: string
    logo: string
    name: string
    description: string
    introduction: string
  }
>

export const gameCodes = ['five', 'six', 'scandinavian'] as const

export function gameMeta(game: GameCode, pathname: string) {
  const page = gamePages[game]
  return pageMeta(
    `${page.name} – eredmények és statisztikák | Lottery Stats`,
    page.description,
    pathname,
  )
}
