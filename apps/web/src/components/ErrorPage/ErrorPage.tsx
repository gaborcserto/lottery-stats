import { Link } from 'react-router'
import styles from './ErrorPage.module.scss'

export function ErrorPage({
  missing = false,
  message,
}: {
  missing?: boolean
  message?: string
}) {
  return (
    <section className={styles.error}>
      <h1>{missing ? 'Az oldal nem található' : 'Az oldal nem tölthető be'}</h1>
      <p>
        {message ??
          (missing
            ? 'A kért címhez nem tartozik oldal.'
            : 'Az adatok átmenetileg nem érhetők el. Kérjük, próbálja újra később.')}
      </p>
      <Link to="/">Vissza a kezdőlapra</Link>
    </section>
  )
}
