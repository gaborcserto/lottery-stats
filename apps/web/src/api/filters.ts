import type {
  FrequencyQuery,
  GameCode,
  PopulationFilters,
  StatisticsQuery,
} from './contracts'

export const maximumNumbers: Record<GameCode, number> = {
  five: 90,
  six: 45,
  scandinavian: 35,
}
export interface PageFilters {
  population: PopulationFilters
  statistics: StatisticsQuery
  sort: NonNullable<FrequencyQuery['sort']>
  number: number
  numbers: number[]
  page: number
}
function positive(value: string | null, maximum: number) {
  if (!value || !/^\d+$/.test(value)) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 1 && number <= maximum
    ? number
    : undefined
}
function date(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
    return undefined
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined
}
export function parseFilters(
  params: URLSearchParams,
  game: GameCode,
): PageFilters {
  const year = positive(params.get('year'), 9999)
  const week = positive(params.get('week'), 53)
  const from = date(params.get('from_date'))
  const to = date(params.get('to_date'))
  const population: PopulationFilters = {
    ...(year ? { year } : {}),
    ...(week ? { week } : {}),
    ...(from ? { from_date: from } : {}),
    ...(to && (!from || to >= from) ? { to_date: to } : {}),
  }
  const set = params.get('set')
  const sort = params.get('sort')
  const selectedNumbers = [
    ...new Set(
      params
        .getAll('number')
        .map((value) => positive(value, maximumNumbers[game]))
        .filter((value): value is number => value !== undefined),
    ),
  ].sort((a, b) => a - b)
  return {
    population,
    statistics: {
      ...population,
      set:
        game === 'scandinavian'
          ? set === 'manual' || set === 'combined'
            ? set
            : 'machine'
          : 'main',
    },
    sort: sort === 'most' || sort === 'least' ? sort : 'number',
    numbers: selectedNumbers.length ? selectedNumbers : [1],
    number: selectedNumbers[0] ?? 1,
    page: positive(params.get('page'), 1_000_000) ?? 1,
  }
}
