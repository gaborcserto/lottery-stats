import styles from './AppFooter.module.scss'

export function AppFooter() {
  return (
    <footer className={styles.footer}>
      <p>Lottery Stats · Magyar lottóeredmények és statisztikák</p>
      <p>
        A múltbeli gyakoriságok nem jelzik előre a következő sorsolás
        nyerőszámait.
      </p>
    </footer>
  )
}
