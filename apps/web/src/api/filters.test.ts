import { describe, expect, it } from 'vitest'
import { parseFilters } from './filters'

describe('URL statistics filters', () => {
  it.each(['five', 'six', 'scandinavian'] as const)(
    'uses safe %s defaults',
    (game) => {
      const result = parseFilters(
        new URLSearchParams(
          'year=-2&week=54&number=91&sort=invalid&set=bonus&page=NaN',
        ),
        game,
      )
      expect(result.population).toEqual({})
      expect(result.number).toBe(1)
      expect(result.sort).toBe('number')
      expect(result.page).toBe(1)
      expect(result.statistics.set).toBe(
        game === 'scandinavian' ? 'machine' : 'main',
      )
    },
  )
  it.each([
    ['five', 90],
    ['six', 45],
    ['scandinavian', 35],
  ] as const)('validates the %s number boundary', (game, maximum) => {
    expect(
      parseFilters(new URLSearchParams(`number=${maximum}`), game).number,
    ).toBe(maximum)
    expect(
      parseFilters(new URLSearchParams(`number=${maximum + 1}`), game).number,
    ).toBe(1)
  })
  it('deduplicates yearly numbers and rejects values outside the game range', () => {
    expect(
      parseFilters(
        new URLSearchParams('number=1&number=90&number=91&number=90'),
        'five',
      ).numbers,
    ).toEqual([1, 90])
    expect(
      parseFilters(new URLSearchParams('number=91&number=-1'), 'five').numbers,
    ).toEqual([1])
  })
  it('bounds oversized trend selections while retaining the lowest valid numbers', () => {
    const numbers = Array.from({ length: 90 }, (_, index) => index + 1)
    const filters = parseFilters(
      new URLSearchParams(
        numbers.map((number) => `number=${number}`).join('&'),
      ),
      'five',
    )
    expect(filters.numbers).toHaveLength(10)
    expect(filters.numbers).toEqual(numbers.slice(0, 10))
  })
  it('validates real dates and ordered bounds without fabricating dates', () => {
    expect(
      parseFilters(
        new URLSearchParams('from_date=2025-02-29&to_date=0000-01-01'),
        'five',
      ).population,
    ).toEqual({})
    expect(
      parseFilters(
        new URLSearchParams('from_date=2024-02-29&to_date=2024-02-28'),
        'five',
      ).population,
    ).toEqual({ from_date: '2024-02-29' })
    expect(
      parseFilters(
        new URLSearchParams(
          'year=2024&week=53&from_date=2024-01-01&to_date=2024-12-31',
        ),
        'five',
      ).population,
    ).toEqual({
      year: 2024,
      week: 53,
      from_date: '2024-01-01',
      to_date: '2024-12-31',
    })
  })
  it.each(['machine', 'manual', 'combined'])(
    'supports Scandinavian %s without affecting history population',
    (set) => {
      const filters = parseFilters(
        new URLSearchParams(`year=2026&set=${set}`),
        'scandinavian',
      )
      expect(filters.statistics).toEqual({ year: 2026, set })
      expect(filters.population).toEqual({ year: 2026 })
      expect(
        parseFilters(new URLSearchParams(`set=${set}`), 'six').statistics.set,
      ).toBe('main')
    },
  )
})
