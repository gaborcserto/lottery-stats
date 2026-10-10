import styles from './LotteryBall.module.scss'

export function LotteryBall({ value }: { value: number }) {
  return <li className={styles.ball}>{value}</li>
}
