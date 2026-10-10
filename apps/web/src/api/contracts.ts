// Handwritten decoders for the public contract in apps/api/resources/openapi.json.
type Decoder<T> = (value: unknown) => T

export class InvalidResponseError extends Error {
  constructor() {
    super('Az API válasza nem értelmezhető.')
  }
}

function invalid(): never {
  throw new InvalidResponseError()
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : invalid()
}
function integer(min = 0, max = Number.MAX_SAFE_INTEGER): Decoder<number> {
  return (value) =>
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
      ? value
      : invalid()
}
function percentage(value: unknown): number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
    ? value
    : invalid()
}
function choice<const T extends readonly string[]>(
  values: T,
): Decoder<T[number]> {
  return (value) => values.find((item) => item === value) ?? invalid()
}
function nullable<T>(decode: Decoder<T>): Decoder<T | null> {
  return (value) => (value === null ? null : decode(value))
}
function array<T>(decode: Decoder<T>): Decoder<T[]> {
  return (value) => (Array.isArray(value) ? value.map(decode) : invalid())
}
function date(value: unknown): string {
  const result = text(value)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    result.startsWith('0000') ||
    new Date(result).toISOString().slice(0, 10) !== result
  )
    return invalid()
  return result
}
function amount(value: unknown): string {
  const result = text(value)
  return /^\d+\.\d{2}$/.test(result) ? result : invalid()
}
const count = integer()
const year = integer(1, 9999)
const number = integer(1, 90)
const gameCode = choice(['five', 'six', 'scandinavian'])
const scope = choice(['main', 'machine', 'manual', 'combined'])
export type GameCode = ReturnType<typeof gameCode>
export type SetScope = ReturnType<typeof scope>
export interface PopulationFilters {
  year?: number
  week?: number
  from_date?: string
  to_date?: string
}
export interface StatisticsQuery extends PopulationFilters {
  set?: SetScope
}
export interface HistoryQuery extends PopulationFilters {
  page?: number
  per_page?: number
}
export interface FrequencyQuery extends StatisticsQuery {
  sort?: 'number' | 'most' | 'least'
  limit?: number
}
export interface PairQuery extends StatisticsQuery {
  limit?: number
}
export interface YearlyQuery extends StatisticsQuery {
  number?: number
}

export function decodeGame(value: unknown) {
  const v = record(value)
  return { code: gameCode(v.code), name: text(v.name) }
}
export type Game = ReturnType<typeof decodeGame>
export function decodeDrawingSummary(value: unknown) {
  const v = record(value)
  return {
    id: integer(1)(v.id),
    year: year(v.year),
    week: integer(1, 53)(v.week),
    drawn_on: nullable(date)(v.drawn_on),
  }
}
function decodeSet(value: unknown) {
  const v = record(value)
  const numbers = array(number)(v.numbers)
  if (
    numbers.length < 1 ||
    numbers.length > 7 ||
    new Set(numbers).size !== numbers.length
  )
    return invalid()
  return {
    type: choice(['main', 'bonus', 'machine', 'manual'])(v.type),
    numbers,
  }
}
function decodePrize(value: unknown) {
  const v = record(value)
  return {
    tier: choice([
      'match_2',
      'match_3',
      'match_4',
      'match_5',
      'match_5_plus_1',
      'match_6',
      'match_7',
    ])(v.tier),
    winner_count: nullable(count)(v.winner_count),
    amount: nullable(amount)(v.amount),
    currency: nullable(choice(['HUF']))(v.currency),
  }
}
export function decodeDrawing(value: unknown) {
  const v = record(value)
  return {
    ...decodeDrawingSummary(v),
    sets: array(decodeSet)(v.sets),
    prizes: array(decodePrize)(v.prizes),
  }
}
export type Drawing = ReturnType<typeof decodeDrawing>
export function decodeSummary(value: unknown) {
  const v = record(value)
  return {
    drawing_count: count(v.drawing_count),
    eligible_set_count: count(v.eligible_set_count),
    min_year: nullable(year)(v.min_year),
    max_year: nullable(year)(v.max_year),
    from_date: nullable(date)(v.from_date),
    to_date: nullable(date)(v.to_date),
    undated_drawing_count: count(v.undated_drawing_count),
  }
}
function decodeFilters(value: unknown): PopulationFilters {
  const v = record(value)
  return {
    ...(v.year === undefined ? {} : { year: year(v.year) }),
    ...(v.week === undefined ? {} : { week: integer(1, 53)(v.week) }),
    ...(v.from_date === undefined ? {} : { from_date: date(v.from_date) }),
    ...(v.to_date === undefined ? {} : { to_date: date(v.to_date) }),
  }
}
function decodeMeta(value: unknown) {
  const v = record(value)
  if (v.percentage_precision !== 2) return invalid()
  return {
    game: gameCode(v.game),
    filters: decodeFilters(v.filters),
    set_scope: scope(v.set_scope),
    drawing_count: count(v.drawing_count),
    eligible_set_count: count(v.eligible_set_count),
    percentage_precision: 2 as const,
  }
}
function decodeFrequency(value: unknown) {
  const v = record(value)
  return {
    number: number(v.number),
    count: count(v.count),
    occurrence_percentage: percentage(v.occurrence_percentage),
  }
}
function decodePair(value: unknown) {
  const v = record(value)
  const first = number(v.first_number),
    second = number(v.second_number)
  if (first >= second) return invalid()
  return {
    first_number: first,
    second_number: second,
    count: count(v.count),
    occurrence_percentage: percentage(v.occurrence_percentage),
  }
}
function decodeShare(value: unknown) {
  const v = record(value)
  return {
    count: count(v.count),
    occurrence_share_percentage: percentage(v.occurrence_share_percentage),
  }
}
function decodeDistribution(value: unknown) {
  const v = record(value)
  return {
    even_count: integer(0, 7)(v.even_count),
    odd_count: integer(0, 7)(v.odd_count),
    eligible_set_count: count(v.eligible_set_count),
    set_percentage: percentage(v.set_percentage),
  }
}
function decodeParity(value: unknown) {
  const v = record(value)
  if (
    v.occurrence_share_percentage_denominator !== 'number_occurrence_count' ||
    v.set_percentage_denominator !== 'eligible_set_count'
  )
    return invalid()
  return {
    number_occurrence_count: count(v.number_occurrence_count),
    occurrence_share_percentage_denominator: 'number_occurrence_count' as const,
    set_percentage_denominator: 'eligible_set_count' as const,
    even: decodeShare(v.even),
    odd: decodeShare(v.odd),
    distribution: array(decodeDistribution)(v.distribution),
  }
}
function decodeYearly(value: unknown) {
  const v = record(value)
  return {
    year: year(v.year),
    drawing_count: count(v.drawing_count),
    eligible_set_count: count(v.eligible_set_count),
    number_occurrence_count: count(v.number_occurrence_count),
    ...(v.selected_number_count === undefined
      ? {}
      : { selected_number_count: count(v.selected_number_count) }),
    ...(v.selected_number_occurrence_percentage === undefined
      ? {}
      : {
          selected_number_occurrence_percentage: percentage(
            v.selected_number_occurrence_percentage,
          ),
        }),
  }
}
export function envelope<T>(decode: Decoder<T>): Decoder<{ data: T }> {
  return (value) => ({ data: decode(record(value).data) })
}
function statistics<T>(decode: Decoder<T>) {
  return (value: unknown) => {
    const v = record(value)
    return { data: decode(v.data), meta: decodeMeta(v.meta) }
  }
}
export const decodeGames = envelope(array(decodeGame))
export const decodeGameResponse = envelope(decodeGame)
export const decodeDrawingResponse = envelope(decodeDrawing)
export const decodeSummaryResponse = statistics(decodeSummary)
export const decodeParityResponse = statistics(decodeParity)
export function decodeFrequenciesResponse(value: unknown) {
  const v = record(value),
    meta = record(v.meta)
  if (meta.occurrence_percentage_denominator !== 'eligible_set_count')
    return invalid()
  return {
    ...statistics(array(decodeFrequency))(v),
    meta: {
      ...decodeMeta(meta),
      occurrence_percentage_denominator: 'eligible_set_count' as const,
      sort: choice(['number', 'most', 'least'])(meta.sort),
      limit: integer(1, 90)(meta.limit),
    },
  }
}
export function decodePairsResponse(value: unknown) {
  const v = record(value),
    meta = record(v.meta)
  if (
    meta.occurrence_percentage_denominator !== 'eligible_set_count' ||
    meta.sort !== 'most'
  )
    return invalid()
  return {
    ...statistics(array(decodePair))(v),
    meta: {
      ...decodeMeta(meta),
      occurrence_percentage_denominator: 'eligible_set_count' as const,
      sort: 'most' as const,
      limit: integer(1, 100)(meta.limit),
    },
  }
}
export function decodeYearlyResponse(value: unknown) {
  const v = record(value),
    meta = record(v.meta)
  if (meta.occurrence_percentage_denominator !== 'yearly_eligible_set_count')
    return invalid()
  const result = statistics(array(decodeYearly))(v)
  const selected = nullable(number)(meta.selected_number)
  if (
    result.data.some((row) =>
      selected === null
        ? row.selected_number_count !== undefined ||
          row.selected_number_occurrence_percentage !== undefined
        : row.selected_number_count === undefined ||
          row.selected_number_occurrence_percentage === undefined,
    )
  )
    return invalid()
  return {
    ...result,
    meta: {
      ...result.meta,
      selected_number: selected,
      occurrence_percentage_denominator: 'yearly_eligible_set_count' as const,
    },
  }
}
export function decodeDrawingPage(value: unknown) {
  const v = record(value),
    links = record(v.links),
    meta = record(v.meta)
  return {
    data: array(decodeDrawingSummary)(v.data),
    links: {
      first: text(links.first),
      last: text(links.last),
      prev: nullable(text)(links.prev),
      next: nullable(text)(links.next),
    },
    meta: {
      current_page: integer(1)(meta.current_page),
      from: nullable(integer(1))(meta.from),
      last_page: integer(1)(meta.last_page),
      path: text(meta.path),
      per_page: integer(1, 100)(meta.per_page),
      to: nullable(integer(1))(meta.to),
      total: count(meta.total),
      links: array((value) => {
        const link = record(value)
        if (typeof link.active !== 'boolean') return invalid()
        return {
          url: nullable(text)(link.url),
          label: text(link.label),
          active: link.active,
          ...(link.page === undefined
            ? {}
            : { page: nullable(integer(1))(link.page) }),
        }
      })(meta.links),
    },
  }
}
