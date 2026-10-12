import { NumberPicker } from '../NumberPicker'
import { useTheme } from '../ThemeProvider'
import { getTrendColors } from '../../config/trend-colors'
import { lazy, memo, useMemo, useState } from 'react'
import { LuChartLine, LuLink } from 'react-icons/lu'
import { useSearchParams } from 'react-router'
import { api, ApiError } from '../../api/client'
import type { GameCode } from '../../api/contracts'
import type { GamePageData } from '../../api/page-data'
import {
  maximumNumbers,
  maximumTrendSelections,
  parseFilters,
  type PageFilters,
} from '../../api/filters'
import { cachedResource } from '../../api/resource'
import { useResource } from '../../api/use-resource'
import { ChartSlot } from '../ChartSlot'
import styles from './StatisticsDetails.module.scss'

const YearlyTrendChart = lazy(() =>
  import('../YearlyTrendChart').then((module) => ({
    default: memo(module.YearlyTrendChart),
  })),
)
const NumberPairsChart = lazy(() =>
  import('../NumberPairsChart').then((module) => ({
    default: memo(module.NumberPairsChart),
  })),
)
const loadSingleYearly = cachedResource((key, signal) => {
  const [game, query] = key.split('?')
  if (game !== 'five' && game !== 'six' && game !== 'scandinavian')
    throw new Error('Invalid game')
  const filters = parseFilters(new URLSearchParams(query), game)
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
  const [game, query] = key.split('?')
  if (game !== 'five' && game !== 'six' && game !== 'scandinavian')
    throw new Error('Invalid game')
  const params = new URLSearchParams(query)
  const numbers = parseFilters(params, game).numbers
  return Promise.all(
    numbers.map((number) => {
      const single = new URLSearchParams(params)
      single.set('number', String(number))
      return loadSingleYearly(`${game}?${single}`, signal)
    }),
  )
})
const loadPairs = cachedResource((key, signal) => {
  const [game, query] = key.split('?')
  if (game !== 'five' && game !== 'six' && game !== 'scandinavian')
    throw new Error('Invalid game')
  const filters = parseFilters(new URLSearchParams(query), game)
  return api
    .pairs(game, { ...filters.statistics, limit: 10 }, signal)
    .then((result) => {
      if (
        result.meta.game !== game ||
        result.meta.set_scope !== filters.statistics.set
      )
        throw new ApiError('invalid-response')
      return result
    })
})

export function StatisticsDetails({
  game,
  data,
  filters,
  hydrated,
  className = '',
}: {
  game: GameCode
  data: GamePageData
  filters: PageFilters
  hydrated: boolean
  className?: string
}) {
  const [params, setParams] = useSearchParams()
  const { resolvedTheme } = useTheme()
  const seriesColors = getTrendColors(resolvedTheme)
  const [retryYearly, setRetryYearly] = useState(false)
  const [retryPairs, setRetryPairs] = useState(false)
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters.statistics))
    if (value !== undefined) query.set(key, String(value))
  const pairsKey = `${game}?${query}`
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
  const pairs = useResource(hydrated && retryPairs ? pairsKey : null, loadPairs)
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
  const trendData =
    loadedTrend ??
    (yearly.loading || yearly.error
      ? (yearly.previousData ?? defaultTrend)
      : filters.numbers.length === 1 && filters.number === 1 && data.yearly
        ? defaultTrend
        : undefined)
  const pairsData = pairs.data ?? data.pairs
  const yearlyError = yearly.data
    ? null
    : (yearly.error ?? (filters.number === 1 ? data.yearlyError : null))
  const pairsError = pairs.data ? null : (pairs.error ?? data.pairsError)
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
  return (
    <div className={`${styles.sections} ${className}`}>
      <section className={styles.card} aria-labelledby="trends-heading">
        <h2 id="trends-heading">
          <LuChartLine aria-hidden="true" /> Éves számgyakoriság
        </h2>
        <NumberPicker
          maximum={maximumNumbers[game]}
          maximumSelections={maximumTrendSelections}
          numbers={filters.numbers}
          colorForNumber={(number) => {
            const plottedIndex =
              trendData?.findIndex(
                (result) => result.meta.selected_number === number,
              ) ?? -1
            const index =
              plottedIndex >= 0 ? plottedIndex : filters.numbers.indexOf(number)
            return seriesColors[index % seriesColors.length]
          }}
          onChange={(numbers) => {
            const next = new URLSearchParams(params)
            next.delete('number')
            for (const number of numbers) next.append('number', String(number))
            setParams(next, { preventScrollReset: true })
          }}
        />
        <p>
          Az arány nevezője az adott év vizsgált számsorainak száma. A hiányzó
          évek nem jelentenek nulla előfordulást. Az ábra nem előrejelzés.
        </p>
        {yearlyError || (!trendData && !yearly.loading) ? (
          <p role="alert">
            {yearlyError ?? 'Az éves adatok nem érhetők el.'}{' '}
            <button
              onClick={() => {
                setRetryYearly(true)
                yearly.retry()
              }}
            >
              Újrapróbálkozás
            </button>
          </p>
        ) : yearly.loading ? (
          <p role="status">Az éves adatok betöltése…</p>
        ) : null}
        {trendData &&
          (trendData.some((result) => result.data.length) ? (
            <>
              <ChartSlot
                className={styles.yearlyChartSlot}
                label="Éves gyakorisági vonaldiagram"
                busy={yearly.loading}
              >
                {trendSeries && <YearlyTrendChart series={trendSeries} />}
              </ChartSlot>
              <div
                className={styles.tableWrap}
                tabIndex={0}
                aria-label="Éves adatok"
              >
                <table>
                  <caption>
                    {trendData
                      .map((result) => `${result.meta.selected_number}. szám`)
                      .join(', ')}{' '}
                    éves előfordulásai
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Szám · év</th>
                      <th scope="col">Előfordulás</th>
                      <th scope="col">Vizsgált számsor</th>
                      <th scope="col">Arány</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendData.flatMap((result) =>
                      result.data.map((row) => (
                        <tr key={`${result.meta.selected_number}-${row.year}`}>
                          <th scope="row">
                            {result.meta.selected_number}. szám · {row.year}
                          </th>
                          <td>{row.selected_number_count}</td>
                          <td>{row.eligible_set_count}</td>
                          <td>{row.selected_number_occurrence_percentage}%</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p>Nincs éves adat a kiválasztott időszakban.</p>
          ))}
      </section>
      <section className={styles.card} aria-labelledby="pairs-heading">
        <h2 id="pairs-heading">
          <LuLink aria-hidden="true" /> Gyakori számpárok
        </h2>
        <p>
          Egy pár egyszer számít minden olyan vizsgált számsorban, amely mindkét
          számot tartalmazza. Az arány nevezője{' '}
          {pairsData?.meta.eligible_set_count ?? 'a vizsgált'} számsor. A gépi
          és kézi sorok között nem képzünk párokat.
        </p>
        {pairsError || (!pairsData && !pairs.loading) ? (
          <p role="alert">
            {pairsError ?? 'A számpárok nem érhetők el.'}{' '}
            <button
              onClick={() => {
                setRetryPairs(true)
                pairs.retry()
              }}
            >
              Újrapróbálkozás
            </button>
          </p>
        ) : pairs.loading ? (
          <p>A számpárok betöltése…</p>
        ) : null}
        {pairsData &&
          (pairsData.data.length ? (
            <>
              <ChartSlot
                className={styles.pairsChartSlot}
                label="Számpárok gyakorisági ábrája"
              >
                <NumberPairsChart data={pairsData.data} />
              </ChartSlot>
              <div
                className={`${styles.tableWrap} ${styles.pairsTable}`}
                aria-label="Számpárok adatai"
              >
                <table>
                  <caption>A tíz leggyakoribb megfigyelt számpár</caption>
                  <thead>
                    <tr>
                      <th scope="col">Számpár</th>
                      <th scope="col">Előfordulás</th>
                      <th scope="col">Arány</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairsData.data.map((row) => (
                      <tr key={`${row.first_number}-${row.second_number}`}>
                        <th scope="row">
                          {row.first_number} + {row.second_number}
                        </th>
                        <td>{row.count}</td>
                        <td>{row.occurrence_percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p>Nincs megfigyelt számpár a kiválasztott időszakban.</p>
          ))}
      </section>
    </div>
  )
}
