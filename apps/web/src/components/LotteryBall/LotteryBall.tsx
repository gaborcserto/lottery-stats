import styles from './LotteryBall.module.scss'

export function LotteryBall({
  value,
  as: Element = 'li',
  tone = 'default',
}: {
  value: number
  as?: 'li' | 'span'
  tone?: 'default' | 'most' | 'least'
}) {
  const toneClass = tone === 'default' ? '' : styles[tone]
  return (
    <Element className={`${styles.ball} ${toneClass}`.trim()}>{value}</Element>
  )
}
