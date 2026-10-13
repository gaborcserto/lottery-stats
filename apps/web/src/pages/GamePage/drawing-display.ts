import type { GameCode } from '../../api/contracts'

export const setLabels = {
  main: 'Főszámok',
  bonus: 'Pótszámok',
  machine: 'Gépi számsor',
  manual: 'Kézi számsor',
}

export function isRelevantSet(game: GameCode, type: keyof typeof setLabels) {
  if (game === 'five') return type === 'main'
  if (game === 'six') return type === 'main' || type === 'bonus'
  return type === 'machine' || type === 'manual'
}

export function dateLabel(value: string) {
  return new Intl.DateTimeFormat('hu-HU', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}
