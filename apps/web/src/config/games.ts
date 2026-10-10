import type { GameCode } from '../api/contracts'

export const gamePages = {
  five: {
    path: '/otoslotto',
    logo: '/images/logos/otoslotto.png',
    name: 'Ötöslottó',
    description:
      'Ötöslottó eredmények és alapvető statisztikák a rendelkezésre álló történelmi sorsolásokból.',
    introduction:
      'Az Ötöslottó sorsolásain öt főszámot húznak ki az 1 és 90 közötti számokból.',
  },
  six: {
    path: '/hatoslotto',
    logo: '/images/logos/hatoslotto.png',
    name: 'Hatoslottó',
    description:
      'Hatoslottó eredmények és történelmi statisztikák. A korábbi pótszámokat külön mutatjuk.',
    introduction:
      'A Hatoslottó hat főszámot használ az 1 és 45 közötti tartományból. A történelmi pótszámok külön szerepelnek, és nem részei a főszámok statisztikáinak.',
  },
  scandinavian: {
    path: '/skandinav-lotto',
    logo: '/images/logos/skandinav-lotto.png',
    name: 'Skandináv lottó',
    description:
      'Skandináv lottó eredmények külön gépi és kézi számsorral, valamint alapvető történelmi statisztikákkal.',
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
export function gameMeta(game: GameCode) {
  const page = gamePages[game]
  return [
    { title: `${page.name} eredmények és statisztikák | Lottery Stats` },
    { name: 'description', content: page.description },
  ]
}
