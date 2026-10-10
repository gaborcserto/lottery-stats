import type { Drawing, GameCode } from '../api/contracts'
import {
  decodeFrequenciesResponse,
  decodeParityResponse,
  decodeSummaryResponse,
} from '../api/contracts.ts'
import type { GamePageData } from '../api/page-data'

export function deferred<T>() {
  let complete: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    complete = resolve
  })
  return {
    promise,
    resolve(value: T) {
      if (!complete) throw new Error('Deferred promise was not initialized')
      complete(value)
    },
  }
}

export function fixturePageData(game: GameCode): GamePageData {
  const fixture = fixtureResponses(game)
  return {
    latest: fixture.drawing.data,
    summary: decodeSummaryResponse(fixture.summary),
    frequencies: decodeFrequenciesResponse(fixture.frequencies),
    mostFrequent: decodeFrequenciesResponse(fixture.mostFrequencies),
    leastFrequent: decodeFrequenciesResponse(fixture.leastFrequencies),
    parity: decodeParityResponse(fixture.parity),
    history: [fixture.drawing.data],
    historyError: null,
    capturedAt: '2026-10-10T00:00:00.000Z',
  }
}

// Deterministic test data only; production snapshot acquisition never imports this module.
export const fixtureGames = {
  data: [
    { code: 'five', name: 'Ötöslottó' },
    { code: 'six', name: 'Hatoslottó' },
    { code: 'scandinavian', name: 'Skandináv lottó' },
  ],
}
export function fixtureResponses(game: GameCode) {
  const main =
    game === 'five'
      ? [1, 12, 23, 34, 45]
      : game === 'six'
        ? [1, 12, 23, 34, 44, 45]
        : [1, 5, 12, 23, 30, 34, 35]
  const maximum = game === 'five' ? 90 : game === 'six' ? 45 : 35
  const scope = game === 'scandinavian' ? 'machine' : 'main'
  const drawing: Drawing = {
    id: 7,
    year: 2026,
    week: 40,
    drawn_on: '2026-10-03',
    sets:
      game === 'scandinavian'
        ? [
            { type: 'machine', numbers: main },
            { type: 'manual', numbers: [2, 6, 13, 24, 29, 33, 35] },
          ]
        : [{ type: 'main', numbers: main }],
    prizes: [
      {
        tier: 'match_5',
        winner_count: 1,
        amount: '9007199254740993.25',
        currency: 'HUF',
      },
    ],
  }
  const meta = {
    game,
    filters: {},
    set_scope: scope,
    drawing_count: 1,
    eligible_set_count: 1,
    percentage_precision: 2,
  }
  const summary = {
    data: {
      drawing_count: 1,
      eligible_set_count: 1,
      min_year: 2026,
      max_year: 2026,
      from_date: '2026-10-03',
      to_date: '2026-10-03',
      undated_drawing_count: 0,
    },
    meta,
  }
  const frequencies = {
    data: Array.from({ length: maximum }, (_, index) => ({
      number: index + 1,
      count: main.includes(index + 1) ? 1 : 0,
      occurrence_percentage: main.includes(index + 1) ? 100 : 0,
    })),
    meta: {
      ...meta,
      occurrence_percentage_denominator: 'eligible_set_count',
      sort: 'number',
      limit: maximum,
    },
  }
  const ranked = frequencies.data.slice()
  const mostFrequencies = {
    data: ranked
      .slice()
      .sort(
        (first, second) =>
          second.count - first.count || first.number - second.number,
      )
      .slice(0, 3),
    meta: { ...frequencies.meta, sort: 'most', limit: 3 },
  }
  const leastFrequencies = {
    data: ranked
      .slice()
      .sort(
        (first, second) =>
          first.count - second.count || first.number - second.number,
      )
      .slice(0, 3),
    meta: { ...frequencies.meta, sort: 'least', limit: 3 },
  }
  const root = 'https://example.test/api/v1/games/' + game + '/drawings'
  return {
    game: { data: fixtureGames.data.find((item) => item.code === game) },
    drawing: { data: drawing },
    summary,
    frequencies,
    mostFrequencies,
    leastFrequencies,
    history: {
      data: [{ id: 7, year: 2026, week: 40, drawn_on: null }],
      links: {
        first: root + '?page=1',
        last: root + '?page=1',
        prev: null,
        next: null,
      },
      meta: {
        current_page: 1,
        from: 1,
        last_page: 1,
        links: [{ url: null, label: 'Previous', active: false, page: null }],
        path: root,
        per_page: 20,
        to: 1,
        total: 1,
      },
    },
    parity: {
      data: {
        number_occurrence_count: 5,
        occurrence_share_percentage_denominator: 'number_occurrence_count',
        set_percentage_denominator: 'eligible_set_count',
        even: { count: 2, occurrence_share_percentage: 40 },
        odd: { count: 3, occurrence_share_percentage: 60 },
        distribution: [
          {
            even_count: 2,
            odd_count: 3,
            eligible_set_count: 1,
            set_percentage: 100,
          },
        ],
      },
      meta,
    },
    pairs: {
      data: [
        {
          first_number: 1,
          second_number: 12,
          count: 1,
          occurrence_percentage: 100,
        },
      ],
      meta: {
        ...meta,
        occurrence_percentage_denominator: 'eligible_set_count',
        sort: 'most',
        limit: 20,
      },
    },
    yearly: {
      data: [
        {
          year: 2026,
          drawing_count: 1,
          eligible_set_count: 1,
          number_occurrence_count: main.length,
        },
      ],
      meta: {
        ...meta,
        selected_number: null,
        occurrence_percentage_denominator: 'yearly_eligible_set_count',
      },
    },
  }
}
