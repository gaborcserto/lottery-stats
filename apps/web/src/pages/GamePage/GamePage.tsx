import { lazy } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { GameCode } from '../../api/contracts'
import type { GamePageData } from '../../api/page-data'
import { PrizeBreakdown } from '../../components/PrizeBreakdown'
import { LotteryBall } from '../../components/LotteryBall'
import { gamePages } from '../../config/games'
import styles from './GamePage.module.scss'
import { StatisticsFilters } from '../../components/StatisticsFilters'
import { StatisticsDetails } from '../../components/StatisticsDetails'
import { ChartSlot } from '../../components/ChartSlot'
import { parseFilters } from '../../api/filters'
import { cachedResource } from '../../api/resource'
import { useResource } from '../../api/use-resource'
import { api } from '../../api/client'
import { loadGame, loadHistory } from '../../api/page-data'
import { useHydrated } from '../../api/use-hydrated'

const FrequencyChart = lazy(() =>
  import('../../components/FrequencyChart').then((module) => ({
    default: module.FrequencyChart,
  })),
)
const ParityChart = lazy(() =>
  import('../../components/ParityChart').then((module) => ({
    default: module.ParityChart,
  })),
)
const loadFiltered = cachedResource((key, signal) => {
  const [game, query] = key.split('?')
  if (game !== 'five' && game !== 'six' && game !== 'scandinavian')
    throw new Error('Invalid game')
  const filters = parseFilters(new URLSearchParams(query), game)
  return loadGame(api, game, signal, filters.population, filters.statistics.set)
})
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
  )
})

const setLabels = {
  main: 'Főszámok',
  bonus: 'Pótszámok',
  machine: 'Gépi számsor',
  manual: 'Kézi számsor',
}

function isRelevantSet(game: GameCode, type: keyof typeof setLabels) {
  if (game === 'five') return type === 'main'
  if (game === 'six') return type === 'main' || type === 'bonus'
  return type === 'machine' || type === 'manual'
}

function count(value: number) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('hu-HU', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

export function GamePage({
  game,
  data: initialData,
}: {
  game: GameCode
  data: GamePageData
}) {
  const [params, setParams] = useSearchParams()
  const hydrated = useHydrated()
  const filters = parseFilters(hydrated ? params : new URLSearchParams(), game)
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters.statistics))
    if (value !== undefined) query.set(key, String(value))
  const isFiltered =
    Object.keys(filters.population).length > 0 ||
    filters.statistics.set === 'manual' ||
    filters.statistics.set === 'combined'
  const filtered = useResource(
    hydrated && isFiltered ? `${game}?${query}` : null,
    loadFiltered,
  )
  const data = filtered.data ?? initialData
  const historyQuery = new URLSearchParams()
  for (const [key, value] of Object.entries(filters.population))
    if (value !== undefined) historyQuery.set(key, String(value))
  historyQuery.set('page', String(filters.page))
  const historyResult = useResource(
    hydrated && filters.page > 1 ? `${game}?${historyQuery}` : null,
    loadHistoryPage,
  )
  const history =
    filters.page > 1 ? (historyResult.data?.history ?? []) : data.history
  const historyError =
    filters.page > 1
      ? (historyResult.error ?? historyResult.data?.historyError)
      : data.historyError
  const pagination =
    filters.page > 1 ? historyResult.data?.historyPage : data.historyPage
  const frequencies = data.frequencies.data
    .slice()
    .sort((a, b) =>
      filters.sort === 'most'
        ? b.count - a.count || a.number - b.number
        : filters.sort === 'least'
          ? a.count - b.count || a.number - b.number
          : a.number - b.number,
    )
  const page = gamePages[game]
  const summary = data.summary.data
  const parity = data.parity.data
  const most = data.mostFrequent.data
  const least = data.leastFrequent.data

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/" prefetch="intent">
        ← Vissza a főoldalra
      </Link>
      {data.refreshError && (
        <p className={styles.refreshStatus} role="status">
          A frissítés nem sikerült. A korábban elérhető adatokat látod.{' '}
          {data.refreshError}
        </p>
      )}
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Lottóstatisztikák</p>
          <h1>{page.name}</h1>
          <p>{page.introduction}</p>
          <p className={styles.historyNote}>
            A múltbeli gyakoriság leíró adat, és nem növeli egy szám későbbi
            kihúzásának esélyét.
          </p>
        </div>
        <img
          src={page.logo}
          alt={`${page.name} logó`}
          width="180"
          height="90"
        />
      </header>

      <StatisticsFilters game={game} filters={filters} />
      {filtered.loading && (
        <p aria-live="polite">
          A szűrt adatok betöltése… Addig a korábbi adatpillanatkép látható.
        </p>
      )}
      {filtered.error && (
        <p role="alert">
          A szűrés nem sikerült; a korábbi adatpillanatkép látható.{' '}
          {filtered.error}{' '}
          <button onClick={filtered.retry}>Újrapróbálkozás</button>
        </p>
      )}
      <p className={styles.caption}>
        Megjelenített statisztikai számsor:{' '}
        {data.summary.meta.set_scope === 'combined'
          ? 'gépi és kézi együtt'
          : data.summary.meta.set_scope === 'manual'
            ? 'kézi'
            : data.summary.meta.set_scope === 'machine'
              ? 'gépi'
              : 'főszámok'}
        .
      </p>

      <section className={styles.latest} aria-labelledby="latest-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Legfrissebb eredmény</p>
            <h2 id="latest-heading">Legutóbbi sorsolás</h2>
          </div>
          {data.latest?.drawn_on && (
            <time dateTime={data.latest.drawn_on}>
              {dateLabel(data.latest.drawn_on)}
            </time>
          )}
        </div>
        {data.latest ? (
          <>
            <p className={styles.drawingMeta}>
              {data.latest.year}. év · {data.latest.week}. hét
            </p>
            <div className={styles.resultSets}>
              {data.latest.sets
                .filter((set) => isRelevantSet(game, set.type))
                .map((set) => (
                  <div className={styles.resultSet} key={set.type}>
                    <h3>{setLabels[set.type]}</h3>
                    <ul
                      className={styles.balls}
                      aria-label={setLabels[set.type]}
                    >
                      {set.numbers.map((value) => (
                        <LotteryBall key={value} value={value} />
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <p>Még nincs elérhető sorsolási adat.</p>
        )}
      </section>

      <section className={styles.summary} aria-labelledby="summary-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Az adatok lefedettsége</p>
            <h2 id="summary-heading">Történeti áttekintés</h2>
          </div>
        </div>
        {summary.drawing_count > 0 ? (
          <div className={styles.summaryGrid}>
            <article>
              <span>Sorsolás</span>
              <strong>{count(summary.drawing_count)}</strong>
            </article>
            <article>
              <span>Vizsgált számsor</span>
              <strong>{count(summary.eligible_set_count)}</strong>
            </article>
            <article>
              <span>Elérhető évek</span>
              <strong>
                {summary.min_year}–{summary.max_year}
              </strong>
            </article>
            <article>
              <span>Ismert dátumú időszak</span>
              <strong>
                {summary.from_date
                  ? dateLabel(summary.from_date)
                  : 'Nincs adat'}{' '}
                – {summary.to_date ? dateLabel(summary.to_date) : 'Nincs adat'}
              </strong>
            </article>
          </div>
        ) : (
          <p>Még nincs elérhető történeti sorsolás.</p>
        )}
        {summary.undated_drawing_count > 0 && (
          <p className={styles.caption}>
            {count(summary.undated_drawing_count)} sorsolás dátuma nem ismert.
          </p>
        )}
      </section>

      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="frequency-heading">
          <p className={styles.eyebrow}>Számok a történeti adatokban</p>
          <h2 id="frequency-heading">Számgyakoriság</h2>
          <p className={styles.caption}>
            Az arány nevezője a{' '}
            {count(data.frequencies.meta.eligible_set_count)} vizsgált számsor;
            az előfordulás minden számsorban legfeljebb egyszer számít.
          </p>
          <div className={styles.highlights}>
            <div>
              <h3>Leggyakoribbak</h3>
              <p>
                {most.length
                  ? most
                      .map((row) => `${row.number} (${count(row.count)})`)
                      .join(' · ')
                  : 'Nincs adat'}
              </p>
            </div>
            <div>
              <h3>Legritkábbak</h3>
              <p>
                {least.length
                  ? least
                      .map((row) => `${row.number} (${count(row.count)})`)
                      .join(' · ')
                  : 'Nincs adat'}
              </p>
            </div>
          </div>
          {data.frequencies.meta.eligible_set_count > 0 ? (
            <ChartSlot label="Számgyakorisági oszlopdiagram">
              <FrequencyChart data={frequencies} />
            </ChartSlot>
          ) : (
            <p>Nincs vizsgált számsor a kiválasztott időszakban.</p>
          )}
          <div
            className={styles.tableWrap}
            tabIndex={0}
            aria-label="Számgyakorisági táblázat"
          >
            <table>
              <caption>
                {page.name}: előfordulások és a vizsgált számsorok aránya
              </caption>
              <thead>
                <tr>
                  <th scope="col">Szám</th>
                  <th scope="col">Előfordulás</th>
                  <th scope="col">Számsorok aránya</th>
                </tr>
              </thead>
              <tbody>
                {frequencies.map((row) => (
                  <tr key={row.number}>
                    <th scope="row">{row.number}</th>
                    <td>{count(row.count)}</td>
                    <td>
                      {row.occurrence_percentage.toLocaleString('hu-HU', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="parity-heading">
          <p className={styles.eyebrow}>Eloszlás</p>
          <h2 id="parity-heading">Páros és páratlan számok</h2>
          <p className={styles.caption}>
            Az előfordulási arány nevezője az összes vizsgált számelőfordulás (
            {count(parity.number_occurrence_count)}).
          </p>
          <ChartSlot label="Páros és páratlan előfordulások">
            <ParityChart data={parity} />
          </ChartSlot>
          <dl className={styles.parityCounts}>
            <div>
              <dt>Páros előfordulás</dt>
              <dd>
                {count(parity.even.count)}{' '}
                <span>
                  (
                  {parity.even.occurrence_share_percentage.toLocaleString(
                    'hu-HU',
                    { maximumFractionDigits: 2 },
                  )}
                  %)
                </span>
              </dd>
            </div>
            <div>
              <dt>Páratlan előfordulás</dt>
              <dd>
                {count(parity.odd.count)}{' '}
                <span>
                  (
                  {parity.odd.occurrence_share_percentage.toLocaleString(
                    'hu-HU',
                    { maximumFractionDigits: 2 },
                  )}
                  %)
                </span>
              </dd>
            </div>
          </dl>
          <h3>Számsoronkénti megoszlás</h3>
          <p className={styles.caption}>
            Az arány nevezője a {count(data.parity.meta.eligible_set_count)}{' '}
            vizsgált számsor.
          </p>
          {parity.distribution.length ? (
            <ul className={styles.distributions}>
              {parity.distribution.map((row) => (
                <li key={`${row.even_count}-${row.odd_count}`}>
                  <span>
                    {row.even_count} páros · {row.odd_count} páratlan
                  </span>
                  <strong>
                    {row.set_percentage.toLocaleString('hu-HU', {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nincs elérhető számsoronkénti adat.</p>
          )}
        </section>
      </div>

      <StatisticsDetails
        game={game}
        data={data}
        filters={
          filtered.loading || filtered.error
            ? parseFilters(new URLSearchParams(), game)
            : filters
        }
        hydrated={hydrated && !filtered.loading && !filtered.error}
      />

      <section className={styles.card} aria-labelledby="history-heading">
        <p className={styles.eyebrow}>Korábbi eredmények</p>
        <h2 id="history-heading">Legutóbbi sorsolások</h2>
        <p className={styles.caption}>
          Oldalanként legfeljebb öt sorsolás, év és hét szerint csökkenő, stabil
          sorrendben.
        </p>
        {historyError ? (
          <p role="alert">
            A sorsolási előzmények nem érhetők el: {historyError}{' '}
            <button
              onClick={
                filters.page > 1
                  ? historyResult.retry
                  : isFiltered
                    ? filtered.retry
                    : () => window.location.reload()
              }
            >
              Újrapróbálkozás
            </button>
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
          <nav
            className={styles.pagination}
            aria-label="Sorsolási előzmények lapozása"
          >
            <button
              disabled={pagination.current <= 1}
              onClick={() => {
                const next = new URLSearchParams(params)
                next.set(
                  'page',
                  String(Math.min(pagination.current - 1, pagination.last)),
                )
                setParams(next, { preventScrollReset: true })
              }}
            >
              Előző
            </button>
            <span>
              {pagination.current}. / {pagination.last}. oldal ·{' '}
              {pagination.total} sorsolás
            </span>
            <button
              disabled={pagination.current >= pagination.last}
              onClick={() => {
                const next = new URLSearchParams(params)
                next.set('page', String(pagination.current + 1))
                setParams(next, { preventScrollReset: true })
              }}
            >
              Következő
            </button>
          </nav>
        )}
      </section>

      {data.latest && (
        <section className={styles.card} aria-labelledby="prizes-heading">
          <p className={styles.eyebrow}>Legutóbbi sorsolás</p>
          <h2 id="prizes-heading">Nyeremények</h2>
          <PrizeBreakdown prizes={data.latest.prizes} />
        </section>
      )}
      <p className={styles.updated}>
        Adatpillanatkép:{' '}
        <time dateTime={data.capturedAt}>{data.capturedAt.slice(0, 10)}</time> ·
        A lefedettség az átvett történeti adatokra vonatkozik.
      </p>
    </div>
  )
}
