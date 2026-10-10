import type { GameCode } from '../../api/contracts'
import type { GamePageData } from '../../api/page-data'
import { gamePages } from '../../config/games'
import { LatestDrawing } from '../../components/LatestDrawing'
import styles from './GamePage.module.scss'

function formatCount(count: number) {
  return count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
}

export function GamePage({
  game,
  data,
}: {
  game: GameCode
  data: GamePageData
}) {
  const page = gamePages[game],
    summary = data.summary.data
  return (
    <div className={styles.game}>
      <h1>{page.name} eredmények és statisztikák</h1>
      <p>{page.introduction}</p>
      <h2>Legutóbbi elérhető sorsolás</h2>
      <LatestDrawing drawing={data.latest} />
      <h2>Történelmi adatok</h2>
      {summary.drawing_count === 0 ? (
        <p>Még nincs elérhető történelmi sorsolás.</p>
      ) : (
        <>
          <p>
            {formatCount(summary.drawing_count)} sorsolás,{' '}
            {formatCount(summary.eligible_set_count)}{' '}
            {game === 'scandinavian' ? 'gépi számsor' : 'főszámsor'}. Évek:{' '}
            {summary.min_year}–{summary.max_year}.
          </p>
          <p>
            Ismert dátumok: {summary.from_date ?? 'nincs adat'} –{' '}
            {summary.to_date ?? 'nincs adat'}. Ismeretlen dátumú sorsolások:{' '}
            {summary.undated_drawing_count}.
          </p>
        </>
      )}
      <p>
        Adatpillanatkép:{' '}
        <time dateTime={data.capturedAt}>
          {data.capturedAt.replace('T', ' ').slice(0, 19)} UTC
        </time>
        . A lefedettség az átvett történelmi adatokra vonatkozik.
      </p>
      <details>
        <summary>Alapvető számgyakoriságok</summary>
        <p>
          A százalékok nevezője: {data.frequencies.meta.eligible_set_count}{' '}
          megfelelő {game === 'scandinavian' ? 'gépi számsor' : 'főszámsor'}.
          Üres adathalmaznál a százalék 0, és nincs megfigyelés.
        </p>
        <div className={styles.table}>
          <table>
            <caption>{page.name} – számgyakoriságok</caption>
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
                  <td>{row.count}</td>
                  <td>
                    {row.occurrence_percentage.toLocaleString('hu-HU', {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
