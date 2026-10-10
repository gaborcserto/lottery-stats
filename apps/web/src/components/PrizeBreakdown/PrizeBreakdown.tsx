import type { Drawing } from '../../api/contracts'
import styles from './PrizeBreakdown.module.scss'

const labels = {
  match_2: '2 találat',
  match_3: '3 találat',
  match_4: '4 találat',
  match_5: '5 találat',
  match_5_plus_1: '5 + 1 találat',
  match_6: '6 találat',
  match_7: '7 találat',
}

function formatAmount(amount: string) {
  const [whole, fraction] = amount.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
  return `${grouped},${fraction}`
}

function formatCount(count: number) {
  return count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
}

export function PrizeBreakdown({ prizes }: { prizes: Drawing['prizes'] }) {
  if (prizes.length === 0)
    return <p className={styles.empty}>Nincs elérhető nyereményadat.</p>

  return (
    <dl className={styles.prizes}>
      {prizes.map((prize) => (
        <div className={styles.prize} key={prize.tier}>
          <dt>{labels[prize.tier]}</dt>
          <dd>
            {prize.amount === null
              ? 'Az összeg nem ismert'
              : `${formatAmount(prize.amount)}${
                  prize.currency === 'HUF' ? ' Ft' : ' (a pénznem nem ismert)'
                }`}
            {prize.winner_count !== null && (
              <span>{formatCount(prize.winner_count)} nyertes</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
