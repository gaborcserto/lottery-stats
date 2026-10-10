import { Link } from 'react-router'
import type { HomePageData } from '../../api/page-data'
import { gamePages } from '../../config/games'
import { LatestDrawing } from '../../components/LatestDrawing'
import styles from './HomePage.module.scss'

export function HomePage({ data }: { data: HomePageData }) {
  return (
    <div className={styles.home}>
      <h1>Lottóeredmények és statisztikák</h1>
      <p>
        Ötöslottó, Hatoslottó és Skandináv lottó: legutóbbi nyerőszámok és
        történelmi adatok a hivatalos forrásból átvett sorsolások alapján.
      </p>
      <p>
        Adatpillanatkép:{' '}
        <time dateTime={data.capturedAt}>
          {data.capturedAt.replace('T', ' ').slice(0, 19)} UTC
        </time>
        . Az eredmények a következő frissítésig változatlanok.
      </p>
      {data.latest.map(({ game, drawing }) => (
        <section key={game}>
          <h2>
            <Link to={gamePages[game].path}>{gamePages[game].name}</Link>
          </h2>
          <LatestDrawing drawing={drawing} />
        </section>
      ))}
    </div>
  )
}
