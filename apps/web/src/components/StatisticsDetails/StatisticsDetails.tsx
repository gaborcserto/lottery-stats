import { lazy, memo, useState } from 'react'
import { LuLink } from 'react-icons/lu'
import { api, ApiError } from '../../api/client'
import type { GameCode } from '../../api/contracts'
import type { GamePageData } from '../../api/page-data'
import { parseFilters, type PageFilters } from '../../api/filters'
import { cachedResource } from '../../api/resource'
import { useResource } from '../../api/use-resource'
import { ChartSlot } from '../ChartSlot'
import { YearlyTrends } from '../YearlyTrends'
import styles from './StatisticsDetails.module.scss'

const NumberPairsChart = lazy(() =>
  import('../NumberPairsChart').then((module) => ({
    default: memo(module.NumberPairsChart),
  })),
)
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
  const [retryPairs, setRetryPairs] = useState(false)
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters.statistics))
    if (value !== undefined) query.set(key, String(value))
  const pairsKey = `${game}?${query}`
  const pairs = useResource(hydrated && retryPairs ? pairsKey : null, loadPairs)
  const pairsData = pairs.data ?? data.pairs
  const pairsError = pairs.data ? null : (pairs.error ?? data.pairsError)

  function handleRetryPairs() {
    setRetryPairs(true)
    pairs.retry()
  }

  return (
    <div className={`${styles.sections} ${className}`}>
      <YearlyTrends
        game={game}
        data={data}
        filters={filters}
        hydrated={hydrated}
        className={styles.card}
      />
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
            <button onClick={handleRetryPairs}>Újrapróbálkozás</button>
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
