import type { Drawing } from '../../api/contracts'
import styles from './LatestDrawing.module.scss'

const setLabels = {
  main: 'Főszámok',
  bonus: 'Pótszám',
  machine: 'Gépi számsor',
  manual: 'Kézi számsor',
}
const prizeLabels = {
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
  return `${BigInt(whole).toLocaleString('hu-HU')},${fraction}`
}

export function LatestDrawing({ drawing }: { drawing: Drawing | null }) {
  if (!drawing) return <p>Még nincs elérhető sorsolási adat.</p>
  return (
    <div className={styles.drawing}>
      <p>
        {drawing.year}. év, {drawing.week}. hét ·{' '}
        {drawing.drawn_on ? (
          <time dateTime={drawing.drawn_on}>
            {drawing.drawn_on.replaceAll('-', '. ')}
          </time>
        ) : (
          'A sorsolás dátuma nem ismert.'
        )}
      </p>
      <dl>
        {drawing.sets.map((set) => (
          <div key={set.type}>
            <dt>{setLabels[set.type]}</dt>
            <dd>{set.numbers.join(', ')}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>Nyereményadatok</summary>
        {drawing.prizes.length === 0 ? (
          <p>Nincs elérhető nyereményadat.</p>
        ) : (
          <ul>
            {drawing.prizes.map((prize) => (
              <li key={prize.tier}>
                {prizeLabels[prize.tier]}:{' '}
                {prize.amount === null
                  ? 'A nyeremény összege nem ismert.'
                  : `${formatAmount(prize.amount)}${prize.currency === 'HUF' ? ' Ft' : ' (a pénznem nem ismert)'}`}{' '}
                ·{' '}
                {prize.winner_count === null
                  ? 'A nyertesek száma nem ismert.'
                  : `${prize.winner_count} nyertes`}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  )
}
