import { describe, expect, it } from 'vitest'
import { mapYearlyTrend } from './mapping'

describe('yearly chart data', () => {
  it('breaks the line for missing years and ineligible populations', () => {
    const row = {
      drawing_count: 1,
      eligible_set_count: 1,
      number_occurrence_count: 5,
      selected_number_count: 0,
      selected_number_occurrence_percentage: 0,
    }
    expect(
      mapYearlyTrend([
        { ...row, year: 2020, selected_number_count: 3 },
        { ...row, year: 2022 },
        { ...row, year: 2023, eligible_set_count: 0 },
      ]),
    ).toEqual([
      { x: 2020, y: 3 },
      { x: 2021, y: null },
      { x: 2022, y: 0 },
      { x: 2023, y: null },
    ])
    expect(mapYearlyTrend([])).toEqual([])
  })
})
