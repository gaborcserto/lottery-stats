import type { GamePageData } from '../../api/page-data'

export function mapYearlyTrend(
  rows: NonNullable<GamePageData['yearly']>['data'],
) {
  if (!rows.length) return []
  const byYear = new Map(rows.map((row) => [row.year, row]))
  const first = rows[0].year
  const last = rows[rows.length - 1].year
  // A null point breaks the line. An absent year is not an observed zero.
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const year = first + index
    const row = byYear.get(year)
    return {
      x: year,
      y:
        row && row.eligible_set_count > 0
          ? (row.selected_number_count ?? null)
          : null,
    }
  })
}
