import { LuHistory } from 'react-icons/lu'
import { useSearchParams } from 'react-router'
import { api } from '../../../api/client'
import type { GameCode } from '../../../api/contracts'
import { parseFilters, type PageFilters } from '../../../api/filters'
import { loadHistory, type GamePageData } from '../../../api/page-data'
import { cachedResource } from '../../../api/resource'
import { useResource } from '../../../api/use-resource'
import { HistoryPagination } from '../../../components/HistoryPagination'
import { dateLabel, isRelevantSet, setLabels } from '../drawing-display'
import pageStyles from '../GamePage.module.scss'
import styles from './GameHistory.module.scss'

const loadHistoryPage = cachedResource((key, signal) => {
  const [game, query] = key.split('?')
  if (game !== 'five' && game !== 'six' && game !== 'scandinavian')
    throw new Error('Invalid game')
  const filters = parseFilters(new URLSearchParams(query), game)
  return loadHistory(
    api,
    game,
    Promise.resolve(null),
    signal,
    filters.population,
    filters.page,
    { throwOnError: true },
  )
})

export function GameHistory({
  game,
  data,
  filters,
  hydrated,
  retryFirstPage,
}: {
  game: GameCode
  data: Pick<GamePageData, 'history' | 'historyError' | 'historyPage'>
  filters: Pick<PageFilters, 'population' | 'page'>
  hydrated: boolean
  retryFirstPage?: () => void
}) {
  const [params, setParams] = useSearchParams()
  const historyQuery = new URLSearchParams()
  for (const [key, value] of Object.entries(filters.population))
    if (value !== undefined) historyQuery.set(key, String(value))
  historyQuery.set('page', String(filters.page))
  const historyResult = useResource(
    hydrated && filters.page > 1 ? `${game}?${historyQuery}` : null,
    loadHistoryPage,
  )
  const history =
    filters.page > 1
      ? (historyResult.data?.history ??
        historyResult.previousData?.history ??
        data.history)
      : data.history
  const historyError =
    filters.page > 1
      ? (historyResult.error ?? historyResult.data?.historyError)
      : data.historyError
  const pagination =
    filters.page > 1
      ? (historyResult.data?.historyPage ??
        historyResult.previousData?.historyPage ??
        data.historyPage)
      : data.historyPage

  function changePage(page: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(page))
    setParams(next, { preventScrollReset: true })
  }

  function retryHistory() {
    if (filters.page > 1) {
      historyResult.retry()
      return
    }
    if (retryFirstPage) {
      retryFirstPage()
      return
    }
    window.location.reload()
  }

  return (
    <section className={pageStyles.card} aria-labelledby="history-heading">
      <h2 id="history-heading">
        <LuHistory aria-hidden="true" /> Korábbi eredmények
      </h2>
      <p className={pageStyles.caption}>
        Oldalanként legfeljebb öt sorsolás, év és hét szerint csökkenő, stabil
        sorrendben.
      </p>
      {historyError ? (
        <p role="alert">
          A sorsolási előzmények nem érhetők el: {historyError}{' '}
          <button onClick={retryHistory}>Újrapróbálkozás</button>
        </p>
      ) : null}
      {historyResult.loading && (
        <p aria-live="polite">A sorsolások betöltése…</p>
      )}
      {history.length ? (
        <ol className={styles.historyList}>
          {history.map((drawing) => (
            <li key={drawing.id}>
              <div className={styles.historyMeta}>
                <strong>
                  {drawing.year}. év · {drawing.week}. hét
                </strong>
                <span>
                  {drawing.drawn_on
                    ? dateLabel(drawing.drawn_on)
                    : 'A dátum nem ismert'}
                </span>
              </div>
              <div className={styles.historySets}>
                {drawing.sets
                  .filter((set) => isRelevantSet(game, set.type))
                  .map((set) => (
                    <p key={set.type}>
                      <strong>{setLabels[set.type]}:</strong>{' '}
                      {set.numbers.join(', ')}
                    </p>
                  ))}
              </div>
            </li>
          ))}
        </ol>
      ) : !historyError && !historyResult.loading ? (
        <p>Még nincs megjeleníthető sorsolás.</p>
      ) : null}
      {pagination && (pagination.last > 1 || pagination.current > 1) && (
        <HistoryPagination
          current={historyResult.loading ? filters.page : pagination.current}
          last={pagination.last}
          busy={historyResult.loading}
          onPageChange={changePage}
        />
      )}
    </section>
  )
}
