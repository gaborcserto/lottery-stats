import { Link } from 'react-router'
import styles from './AppFooter.module.scss'

export function AppFooter() {
  return (
    <footer className={styles.footer}>
      <Link to="/" aria-label="Lottery Stats – Kezdőlap (lábléc)">
        <img
          src="/images/logo.png"
          alt="Lottery Stats"
          width="2172"
          height="724"
        />
      </Link>
    </footer>
  )
}
