import { Link } from 'react-router'
import { LuArrowUpRight, LuCalendarDays } from 'react-icons/lu'
import type { Drawing, GameCode } from '../../api/contracts'
import { gamePages } from '../../config/games'
import { LotteryBall } from '../LotteryBall'
import { PrizeBreakdown } from '../PrizeBreakdown'
import styles from './LotteryCard.module.scss'

const setLabels = {
  main: 'Főszámok',
  bonus: 'Pótszám',
  machine: 'Gépi számsor',
  manual: 'Kézi számsor',
}

const gameLogos = {
  five: '/images/logos/otoslotto.png',
  six: '/images/logos/hatoslotto.png',
  scandinavian: '/images/logos/skandinav-lotto.png',
} satisfies Record<GameCode, string>

function formatDate(date: string) {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export function LotteryCard({
  game,
  drawing,
}: {
  game: GameCode
  drawing: Drawing | null
}) {
  const page = gamePages[game]

  return (
    <article className={styles.card}>
      <header className={styles.heading}>
        <div className={styles.logoFrame}>
          <img
            className={styles.logo}
            src={gameLogos[game]}
            alt={`${page.name} logó`}
          />
        </div>
        <h3 className={styles.accessibleTitle}>{page.name}</h3>
      </header>
      {drawing === null ? (
        <p className={styles.empty}>Még nincs elérhető sorsolási adat.</p>
      ) : (
        <>
          <p className={styles.date}>
            <span className={styles.dateLabel}>Legutóbbi sorsolás</span>
            <LuCalendarDays className={styles.icon} aria-hidden="true" />
            {drawing.drawn_on ? (
              <time dateTime={drawing.drawn_on}>
                {formatDate(drawing.drawn_on)}
              </time>
            ) : (
              'A sorsolás dátuma nem ismert.'
            )}
          </p>
          <div className={styles.sets}>
            {drawing.sets.map((set) => (
              <section className={styles.numberSet} key={set.type}>
                <h4
                  className={
                    set.type === 'main' ? styles.accessibleTitle : undefined
                  }
                >
                  {setLabels[set.type]}
                </h4>
                <ul aria-label={`${page.name}: ${setLabels[set.type]}`}>
                  {set.numbers.map((number) => (
                    <LotteryBall key={number} value={number} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <section className={styles.prizeSection}>
            <h4>Nyeremények</h4>
            <PrizeBreakdown prizes={drawing.prizes} />
          </section>
        </>
      )}
      <Link className={styles.link} to={page.path} prefetch="intent">
        Részletes statisztikák
        <LuArrowUpRight className={styles.icon} aria-hidden="true" />
      </Link>
    </article>
  )
}
