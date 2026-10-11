import { lazy, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api, ApiError } from '../../api/client'
import type { GameCode } from '../../api/contracts'
import type { GamePageData } from '../../api/page-data'
import {
  maximumNumbers,
  parseFilters,
  type PageFilters,
} from '../../api/filters'
import { cachedResource } from '../../api/resource'
import { useResource } from '../../api/use-resource'
import { ChartSlot } from '../ChartSlot'
import styles from './StatisticsDetails.module.scss'

const YearlyTrendChart = lazy(() =>
  import('../YearlyTrendChart').then((module) => ({
    default: module.YearlyTrendChart,
  })),
)
const NumberPairsChart = lazy(() =>
  import('../NumberPairsChart').then((module) => ({
    default: module.NumberPairsChart,
  })),
)
const loadYearly = cachedResource((key, signal) => {
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
}: {
  game: GameCode
  data: GamePageData
  filters: PageFilters
  hydrated: boolean
}) {
  const [params, setParams] = useSearchParams()
  const [retryYearly, setRetryYearly] = useState(false)
  const [retryPairs, setRetryPairs] = useState(false)
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters.statistics))
    if (value !== undefined) query.set(key, String(value))
  const pairsKey = `${game}?${query}`
  query.set('number', String(filters.number))
  const yearly = useResource(
    hydrated && (filters.number !== 1 || retryYearly)
      ? `${game}?${query}`
      : null,
    loadYearly,
  )
  const pairs = useResource(hydrated && retryPairs ? pairsKey : null, loadPairs)
  const trendData =
    filters.number === 1 ? (yearly.data ?? data.yearly) : yearly.data
  const pairsData = pairs.data ?? data.pairs
  const yearlyError = yearly.data
    ? null
    : (yearly.error ?? (filters.number === 1 ? data.yearlyError : null))
  const pairsError = pairs.data ? null : (pairs.error ?? data.pairsError)
  return (
    <div className={styles.sections}>
      <section className={styles.card} aria-labelledby="trends-heading">
        <h2 id="trends-heading">Éves számgyakoriság</h2>
        <label className={styles.select}>
          Vizsgált szám
          <select
            value={filters.number}
            onChange={(event) => {
              const next = new URLSearchParams(params)
              next.set('number', event.currentTarget.value)
              setParams(next, { preventScrollReset: true })
            }}
          >
            {Array.from({ length: maximumNumbers[game] }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </label>
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
          <p>Az éves adatok betöltése…</p>
        ) : null}
        {trendData &&
          (trendData.data.length ? (
            <>
              <ChartSlot label="Éves gyakorisági vonaldiagram">
                <YearlyTrendChart
                  data={trendData.data}
                  number={filters.number}
                />
              </ChartSlot>
              <div
                className={styles.tableWrap}
                tabIndex={0}
                aria-label="Éves adatok"
              >
                <table>
                  <caption>{filters.number}. szám éves előfordulásai</caption>
                  <thead>
                    <tr>
                      <th scope="col">Év</th>
                      <th scope="col">Előfordulás</th>
                      <th scope="col">Vizsgált számsor</th>
                      <th scope="col">Arány</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendData.data.map((row) => (
                      <tr key={row.year}>
                        <th scope="row">{row.year}</th>
                        <td>{row.selected_number_count}</td>
                        <td>{row.eligible_set_count}</td>
                        <td>{row.selected_number_occurrence_percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p>Nincs éves adat a kiválasztott időszakban.</p>
          ))}
      </section>
      <section className={styles.card} aria-labelledby="pairs-heading">
        <h2 id="pairs-heading">Gyakori számpárok</h2>
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
              <ChartSlot label="Számpárok gyakorisági ábrája">
                <NumberPairsChart data={pairsData.data} />
              </ChartSlot>
              <div
                className={styles.tableWrap}
                tabIndex={0}
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
