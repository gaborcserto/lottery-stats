import { lazy, memo, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { LuChartLine } from 'react-icons/lu'
import { FaChevronDown, FaSort, FaSortDown, FaSortUp } from 'react-icons/fa6'
import { useSearchParams } from 'react-router'
import { api, ApiError } from '../../api/client'
import type { GameCode } from '../../api/contracts'
import {
  maximumNumbers,
  maximumTrendSelections,
  parseFilters,
  type PageFilters,
} from '../../api/filters'
import type { GamePageData } from '../../api/page-data'
import { cachedResource } from '../../api/resource'
import { useResource } from '../../api/use-resource'
import { getTrendColors } from '../../config/trend-colors'
import { ChartSlot } from '../ChartSlot'
import { NumberPicker } from '../NumberPicker'
import { useTheme } from '../ThemeProvider'
import styles from './YearlyTrends.module.scss'

const YearlyTrendChart = lazy(() =>
  import('../YearlyTrendChart').then((module) => ({
    default: memo(module.YearlyTrendChart),
  })),
)

type YearlySortColumn = 'year' | 'count' | 'eligible' | 'percentage'
type YearlySort = {
  column: YearlySortColumn
  direction: 'ascending' | 'descending'
}

function isGameCode(value: string | undefined): value is GameCode {
  return value === 'five' || value === 'six' || value === 'scandinavian'
}

function parseYearlyKey(key: string) {
  const [game, query] = key.split('?')
  if (!isGameCode(game)) throw new Error('Invalid game')

  const params = new URLSearchParams(query)
  return { game, params, filters: parseFilters(params, game) }
}

const loadSingleYearly = cachedResource((key, signal) => {
  const { game, filters } = parseYearlyKey(key)
  return api
    .yearly(game, { ...filters.statistics, number: filters.number }, signal)
    .then((result) => {
      if (
        result.meta.game !== game ||
        result.meta.set_scope !== filters.statistics.set ||
        result.meta.selected_number !== filters.number
      )
        throw new ApiError('invalid-response')
      return result
    })
})

const loadYearly = cachedResource(async (key, signal) => {
  const { game, params, filters } = parseYearlyKey(key)
  const numbers = filters.numbers

  return Promise.all(
    numbers.map((number) => {
      const single = new URLSearchParams(params)
      single.set('number', String(number))

      return loadSingleYearly(`${game}?${single}`, signal)
    }),
  )
})

export function YearlyTrends({
  game,
  data,
  filters,
  hydrated,
  className,
}: {
  game: GameCode
  data: Pick<GamePageData, 'yearly' | 'yearlyError'>
  filters: Pick<PageFilters, 'statistics' | 'numbers' | 'number'>
  hydrated: boolean
  className?: string
}) {
  const [params, setParams] = useSearchParams()
  const { resolvedTheme } = useTheme()
  const seriesColors = getTrendColors(resolvedTheme)
  const [retryYearly, setRetryYearly] = useState(false)
  const [yearlySorts, setYearlySorts] = useState<Record<number, YearlySort>>({})
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters.statistics))
    if (value !== undefined) query.set(key, String(value))

  const requestedNumbers =
    data.yearly && !retryYearly
      ? filters.numbers.filter((number) => number !== 1)
      : filters.numbers
  for (const number of requestedNumbers) query.append('number', String(number))
  const yearly = useResource(
    hydrated &&
      requestedNumbers.length > 0 &&
      (requestedNumbers.some((number) => number !== 1) || retryYearly)
      ? `${game}?${query}`
      : null,
    loadYearly,
  )

  const availableYearly =
    yearly.data ?? (!hydrated ? yearly.previousData : undefined)

  const loadedTrend = useMemo(
    () =>
      availableYearly &&
      filters.numbers
        .map((number) =>
          number === 1 && data.yearly && !retryYearly
            ? data.yearly
            : availableYearly.find(
                (result) => result.meta.selected_number === number,
              ),
        )
        .filter((result) => result !== undefined),
    [availableYearly, filters.numbers, data.yearly, retryYearly],
  )

  const defaultTrend = useMemo(
    () => (data.yearly ? [data.yearly] : undefined),
    [data.yearly],
  )

  let trendData = loadedTrend

  if (!trendData) {
    if (yearly.loading || yearly.error) {
      trendData = yearly.previousData ?? defaultTrend
    } else if (
      filters.numbers.length === 1 &&
      filters.number === 1 &&
      data.yearly
    ) {
      trendData = defaultTrend
    }
  }

  const yearlyError = yearly.data
    ? null
    : (yearly.error ?? (filters.number === 1 ? data.yearlyError : null))
  const showYearlyError = Boolean(
    yearlyError || (!trendData && !yearly.loading),
  )
  const showYearlyLoading = !showYearlyError && yearly.loading
  const hasTrendRows = trendData?.some((result) => result.data.length) ?? false

  const trendSeries = useMemo(
    () =>
      trendData?.map((result, index) => ({
        number:
          result.meta.selected_number ??
          filters.numbers[index] ??
          filters.number,
        data: result.data,
      })),
    [trendData, filters.numbers, filters.number],
  )

  function colorForNumber(number: number) {
    const plottedIndex =
      trendData?.findIndex(
        (result) => result.meta.selected_number === number,
      ) ?? -1
    const index =
      plottedIndex >= 0 ? plottedIndex : filters.numbers.indexOf(number)

    return seriesColors[index % seriesColors.length]
  }

  function updateNumbers(numbers: number[]) {
    const next = new URLSearchParams(params)
    next.delete('number')
    for (const number of numbers) next.append('number', String(number))
    setParams(next, { preventScrollReset: true })
  }

  function retryYearlyData() {
    setRetryYearly(true)
    yearly.retry()
  }

  function updateSort(number: number, column: YearlySortColumn) {
    setYearlySorts((current) => {
      const active = current[number] ?? {
        column: 'year' as const,
        direction: 'descending' as const,
      }
      return {
        ...current,
        [number]: {
          column,
          direction:
            active.column === column
              ? active.direction === 'ascending'
                ? 'descending'
                : 'ascending'
              : column === 'year'
                ? 'descending'
                : 'ascending',
        },
      }
    })
  }

  return (
    <section className={className} aria-labelledby="trends-heading">
      <h2 id="trends-heading">
        <LuChartLine aria-hidden="true" /> Éves számgyakoriság
      </h2>
      <NumberPicker
        maximum={maximumNumbers[game]}
        maximumSelections={maximumTrendSelections}
        numbers={filters.numbers}
        colorForNumber={colorForNumber}
        onChange={updateNumbers}
      />
      <p>
        Az arány nevezője az adott év vizsgált számsorainak száma. A hiányzó
        évek nem jelentenek nulla előfordulást. Az ábra nem előrejelzés.
      </p>
      {showYearlyError ? (
        <p role="alert">
          {yearlyError ?? 'Az éves adatok nem érhetők el.'}{' '}
          <button onClick={retryYearlyData}>Újrapróbálkozás</button>
        </p>
      ) : showYearlyLoading ? (
        <p role="status">Az éves adatok betöltése…</p>
      ) : null}
      {trendData &&
        (hasTrendRows ? (
          <>
            <ChartSlot
              className={styles.chartSlot}
              label="Éves gyakorisági vonaldiagram"
              busy={yearly.loading}
            >
              {trendSeries && <YearlyTrendChart series={trendSeries} />}
            </ChartSlot>
            <details className={styles.tableDisclosure}>
              <summary>
                <span>Részletes éves adatok megjelenítése</span>
                <FaChevronDown className={styles.caret} aria-hidden="true" />
              </summary>
              <div className={styles.yearlyCards}>
                {trendData.map((result, index) => {
                  const number =
                    result.meta.selected_number ??
                    filters.numbers[index] ??
                    filters.number
                  const cardStyle = {
                    '--number-color': colorForNumber(number),
                  } as CSSProperties
                  const sort = yearlySorts[number] ?? {
                    column: 'year' as const,
                    direction: 'descending' as const,
                  }
                  const rows = [...result.data].sort((left, right) => {
                    const value = (row: (typeof result.data)[number]) => {
                      switch (sort.column) {
                        case 'year':
                          return row.year
                        case 'count':
                          return row.selected_number_count ?? 0
                        case 'eligible':
                          return row.eligible_set_count
                        case 'percentage':
                          return row.selected_number_occurrence_percentage ?? 0
                      }
                    }

                    return (
                      (value(left) - value(right)) *
                      (sort.direction === 'ascending' ? 1 : -1)
                    )
                  })

                  function sortHeader(column: YearlySortColumn, label: string) {
                    const active = sort.column === column
                    return (
                      <th
                        scope="col"
                        aria-sort={active ? sort.direction : undefined}
                      >
                        <button
                          className={styles.sortButton}
                          type="button"
                          aria-label={`${label}, rendezés ${active && sort.direction === 'ascending' ? 'csökkenő' : 'növekvő'} sorrendbe`}
                          onClick={() => updateSort(number, column)}
                        >
                          {label}
                          <span aria-hidden="true">
                            {active ? (
                              sort.direction === 'ascending' ? (
                                <FaSortUp aria-hidden="true" />
                              ) : (
                                <FaSortDown aria-hidden="true" />
                              )
                            ) : (
                              <FaSort aria-hidden="true" />
                            )}
                          </span>
                        </button>
                      </th>
                    )
                  }

                  return (
                    <section
                      className={styles.yearlyCard}
                      key={number}
                      style={cardStyle}
                      aria-labelledby={`yearly-number-${number}`}
                    >
                      <h3 id={`yearly-number-${number}`}>{number}. szám</h3>
                      <div className={styles.yearlyTableWrap}>
                        <table>
                          <caption>{number}. szám éves előfordulásai</caption>
                          <thead>
                            <tr>
                              {sortHeader('year', 'Év')}
                              {sortHeader('count', 'Előfordulás')}
                              {sortHeader('eligible', 'Vizsgált számsor')}
                              {sortHeader('percentage', 'Arány')}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr key={`${number}-${row.year}`}>
                                <th scope="row">{row.year}</th>
                                <td>{row.selected_number_count}</td>
                                <td>{row.eligible_set_count}</td>
                                <td>
                                  {row.selected_number_occurrence_percentage}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )
                })}
              </div>
            </details>
          </>
        ) : (
          <p>Nincs éves adat a kiválasztott időszakban.</p>
        ))}
    </section>
  )
}
