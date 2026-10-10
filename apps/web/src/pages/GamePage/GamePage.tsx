import { Link } from 'react-router'
import type { GameCode } from '../../api/contracts'
import type { GamePageData } from '../../api/page-data'
import { PrizeBreakdown } from '../../components/PrizeBreakdown'
import { LotteryBall } from '../../components/LotteryBall'
import { gamePages } from '../../config/games'
import styles from './GamePage.module.scss'

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
  data,
}: {
  game: GameCode
  data: GamePageData
}) {
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
          <div className={styles.tableWrap}>
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
                {data.frequencies.data.map((row) => (
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

      <section className={styles.card} aria-labelledby="history-heading">
        <p className={styles.eyebrow}>Korábbi eredmények</p>
        <h2 id="history-heading">Legutóbbi sorsolások</h2>
        <p className={styles.caption}>
          Az első {data.history.length} elérhető sorsolás. Részletes időszak- és
          számkeresés a következő fejlesztési ütemben.
        </p>
        {data.historyError ? (
          <p role="alert">
            A sorsolási előzmények nem érhetők el: {data.historyError}
          </p>
        ) : null}
        {data.history.length ? (
          <ol className={styles.historyList}>
            {data.history.map((drawing) => (
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
        ) : !data.historyError ? (
          <p>Még nincs megjeleníthető sorsolás.</p>
        ) : null}
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
