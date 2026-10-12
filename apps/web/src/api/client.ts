import * as contract from './contracts'
import type {
  FrequencyQuery,
  GameCode,
  HistoryQuery,
  PairQuery,
  StatisticsQuery,
  YearlyQuery,
} from './contracts'

export type ApiErrorKind =
  | 'not-found'
  | 'validation'
  | 'rate-limit'
  | 'server'
  | 'network'
  | 'invalid-response'
  | 'http'
const messages: Record<ApiErrorKind, string> = {
  'not-found': 'A kért sorsolás vagy adat nem található.',
  validation: 'Ellenőrizze a megadott szűrőket, majd próbálja újra.',
  'rate-limit': 'Túl sok kérés. Kérjük, várjon az újrapróbálkozással.',
  server: 'Az adatok átmenetileg nem érhetők el.',
  network:
    'Nem sikerült kapcsolódni az adatforráshoz. Ellenőrizze a kapcsolatot, majd próbálja újra.',
  'invalid-response':
    'Az adatforrás válasza nem értelmezhető. Próbálja meg később.',
  http: 'Az adatok lekérése nem sikerült.',
}
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  readonly retryAt: number | undefined
  readonly fields: string[]
  constructor(
    kind: ApiErrorKind,
    status?: number,
    retryAt?: number,
    fields: string[] = [],
  ) {
    super(
      status === 400 || status === 422
        ? messages.validation
        : status === 401
          ? 'A kéréshez nincs megfelelő hozzáférés.'
          : status === 403
            ? 'A kért tartalomhoz nincs hozzáférése.'
            : status === 404
              ? messages['not-found']
              : status === 429
                ? messages['rate-limit']
                : status === 503
                  ? messages.server
                  : messages[kind],
    )
    this.kind = kind
    this.status = status
    this.retryAt = retryAt
    this.fields = fields
  }
}
export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (value === null) return undefined
  if (/^\d+$/.test(value.trim())) {
    const seconds = Number(value)
    return Number.isSafeInteger(seconds) ? now + seconds * 1000 : undefined
  }
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? Math.max(now, timestamp) : undefined
}

type Query = HistoryQuery | FrequencyQuery | PairQuery | YearlyQuery
export function createApiClient(
  baseUrl = '/api/v1',
  fetcher: typeof fetch = (input, init) => fetch(input, init),
) {
  let retryAt = 0
  async function request<T>(
    path: string,
    decode: (value: unknown) => T,
    query?: Query,
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted()
    if (retryAt > Date.now()) throw new ApiError('rate-limit', 429, retryAt)
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query ?? {}))
      if (value !== undefined) params.set(key, String(value))
    const suffix = params.size ? `?${params}` : ''
    let response: Response
    try {
      response = await fetcher(
        `${baseUrl.replace(/\/$/, '')}${path}${suffix}`,
        { headers: { Accept: 'application/json' }, signal },
      )
    } catch (error) {
      if (
        signal?.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      )
        throw error
      throw new ApiError('network')
    }
    if (!response.ok) {
      const status = response.status
      const kind =
        status === 400 || status === 422
          ? 'validation'
          : status === 404
            ? 'not-found'
            : status === 429
              ? 'rate-limit'
              : status >= 500
                ? 'server'
                : 'http'
      let fields: string[] = []
      if (
        status === 422 &&
        response.headers.get('content-type')?.includes('application/json')
      ) {
        try {
          const body: unknown = await response.json()
          if (
            typeof body === 'object' &&
            body !== null &&
            'errors' in body &&
            typeof body.errors === 'object' &&
            body.errors !== null
          ) {
            fields = Object.keys(body.errors).filter((key) =>
              [
                'year',
                'week',
                'from_date',
                'to_date',
                'set',
                'sort',
                'limit',
                'number',
                'page',
                'per_page',
              ].includes(key),
            )
          }
        } catch {
          /* Status remains authoritative when an error body is malformed. */
        }
      }
      if (status === 429)
        retryAt =
          parseRetryAfter(response.headers.get('Retry-After')) ??
          Date.now() + 60_000
      throw new ApiError(
        kind,
        status,
        status === 429 ? retryAt : undefined,
        fields,
      )
    }
    try {
      if (!response.headers.get('content-type')?.includes('application/json'))
        throw new contract.InvalidResponseError()
      const body: unknown = await response.json()
      return decode(body)
    } catch (error) {
      if (signal?.aborted) throw error
      throw new ApiError('invalid-response', response.status)
    }
  }
  const gamePath = (game: GameCode) => `/games/${game}`
  return {
    games: (signal?: AbortSignal) =>
      request('/games', contract.decodeGames, undefined, signal),
    game: (game: GameCode, signal?: AbortSignal) =>
      request(gamePath(game), contract.decodeGameResponse, undefined, signal),
    drawings: (game: GameCode, query?: HistoryQuery, signal?: AbortSignal) =>
      request(
        `${gamePath(game)}/drawings`,
        contract.decodeDrawingPage,
        query,
        signal,
      ),
    latest: (game: GameCode, signal?: AbortSignal) =>
      request(
        `${gamePath(game)}/drawings/latest`,
        contract.decodeDrawingResponse,
        undefined,
        signal,
      ),
    drawing: (game: GameCode, id: number, signal?: AbortSignal) => {
      if (!Number.isSafeInteger(id) || id < 1)
        throw new ApiError('validation', 422, undefined, ['drawing'])
      return request(
        `${gamePath(game)}/drawings/${id}`,
        contract.decodeDrawingResponse,
        undefined,
        signal,
      )
    },
    summary: (game: GameCode, query?: StatisticsQuery, signal?: AbortSignal) =>
      request(
        `${gamePath(game)}/statistics/summary`,
        contract.decodeSummaryResponse,
        query,
        signal,
      ),
    frequencies: (
      game: GameCode,
      query?: FrequencyQuery,
      signal?: AbortSignal,
    ) =>
      request(
        `${gamePath(game)}/statistics/frequencies`,
        contract.decodeFrequenciesResponse,
        query,
        signal,
      ),
    parity: (game: GameCode, query?: StatisticsQuery, signal?: AbortSignal) =>
      request(
        `${gamePath(game)}/statistics/parity`,
        contract.decodeParityResponse,
        query,
        signal,
      ),
    pairs: (game: GameCode, query?: PairQuery, signal?: AbortSignal) =>
      request(
        `${gamePath(game)}/statistics/pairs`,
        contract.decodePairsResponse,
        query,
        signal,
      ),
    yearly: (game: GameCode, query?: YearlyQuery, signal?: AbortSignal) =>
      request(
        `${gamePath(game)}/statistics/trends/yearly`,
        contract.decodeYearlyResponse,
        query,
        signal,
      ),
  }
}
export type ApiClient = ReturnType<typeof createApiClient>
export const api = createApiClient()
