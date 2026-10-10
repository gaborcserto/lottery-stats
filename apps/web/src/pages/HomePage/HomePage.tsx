import { useEffect, useState } from 'react'
import type { HomePageData } from '../../api/page-data'
import { loadHome } from '../../api/page-data'
import { gameCodes } from '../../config/games'
import { LotteryCard } from '../../components/LotteryCard'
import styles from './HomePage.module.scss'

export function HomePage({ data }: { data: HomePageData }) {
  const [latest, setLatest] = useState(data.latest)
  const [refreshFailed, setRefreshFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void loadHome(undefined, controller.signal)
        .then((result) => {
          setLatest((current) =>
            result.latest.map((item) => ({
              ...item,
              drawing:
                item.drawing ??
                current.find((previous) => previous.game === item.game)
                  ?.drawing ??
                null,
            })),
          )
          setRefreshFailed(false)
        })
        .catch(() => {
          if (!controller.signal.aborted) setRefreshFailed(true)
        })
    }, 0)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  return (
    <div className={`${styles.home} lottery-home`}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>A számok mögött történetek</p>
        <h1>Lottóeredmények, tisztán.</h1>
        <p className={styles.intro}>
          A legutóbbi sorsolások számai és nyereményei, egy helyen.
        </p>
        <section className={styles.results} aria-labelledby="results-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>A legfrissebb eredmények</p>
              <h2 id="results-title">Válassz egy játékot</h2>
            </div>
            {refreshFailed && (
              <p className={styles.refreshStatus} role="status">
                A frissítés nem sikerült. A legutóbb elérhető eredményeket
                látod.
              </p>
            )}
          </div>
          <div className={styles.grid}>
            {gameCodes.map((game) => {
              const drawing = latest.find((item) => item.game === game)?.drawing
              return (
                <LotteryCard key={game} game={game} drawing={drawing ?? null} />
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
