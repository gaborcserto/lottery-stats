import { Link } from 'react-router'
import { LuCircleAlert, LuHouse, LuRefreshCw } from 'react-icons/lu'
import styles from './ErrorPage.module.scss'

const pages = {
  401: {
    title: 'A hozz\u00e1f\u00e9r\u00e9s nem enged\u00e9lyezett',
    message:
      'A k\u00e9rt tartalom jelenleg nem \u00e9rhet\u0151 el ezzel a hozz\u00e1f\u00e9r\u00e9ssel.',
  },
  403: {
    title: 'A hozz\u00e1f\u00e9r\u00e9s megtagadva',
    message: 'Ehhez a tartalomhoz jelenleg nincs hozz\u00e1f\u00e9r\u00e9se.',
  },
  404: {
    title: 'Az oldal nem tal\u00e1lhat\u00f3',
    message:
      'A k\u00e9rt c\u00edmhez nem tartozik oldal. Ellen\u0151rizze a c\u00edmet, vagy t\u00e9rjen vissza a f\u0151oldalra.',
  },
  400: {
    title: 'Ellen\u0151rizze a megadott sz\u0171r\u0151ket',
    message:
      'A k\u00e9r\u00e9s adatai nem fogadhat\u00f3k el. M\u00f3dos\u00edtsa a sz\u0171r\u0151ket, majd pr\u00f3b\u00e1lja \u00fajra.',
  },
  422: {
    title: 'Ellen\u0151rizze a megadott sz\u0171r\u0151ket',
    message:
      'A k\u00e9r\u00e9s adatai nem fogadhat\u00f3k el. M\u00f3dos\u00edtsa a sz\u0171r\u0151ket, majd pr\u00f3b\u00e1lja \u00fajra.',
  },
  500: {
    title: 'V\u00e1ratlan hiba t\u00f6rt\u00e9nt',
    message:
      'Az oldal bet\u00f6lt\u00e9se k\u00f6zben hiba t\u00f6rt\u00e9nt. Pr\u00f3b\u00e1lja \u00fajra, vagy t\u00e9rjen vissza a f\u0151oldalra.',
  },
  503: {
    title: 'A szolg\u00e1ltat\u00e1s \u00e1tmenetileg nem \u00e9rhet\u0151 el',
    message:
      'Az adatforr\u00e1s jelenleg nem v\u00e1laszol. K\u00e9rj\u00fck, pr\u00f3b\u00e1lja meg k\u00e9s\u0151bb.',
  },
} as const

export function ErrorPage({
  status = 500,
  message,
  onRetry,
  retryDisabled = false,
  retryStatus,
}: {
  status?: number
  message?: string
  onRetry?: () => void
  retryDisabled?: boolean
  retryStatus?: string
}) {
  const page = pages[status as keyof typeof pages] ?? pages[500]

  return (
    <section className={styles.error} aria-labelledby="error-heading">
      <div className={styles.mark} aria-hidden="true">
        <LuCircleAlert />
        <span>{status}</span>
      </div>
      <p className={styles.brand}>Lottery Stats</p>
      <h1 id="error-heading">{page.title}</h1>
      <p className={styles.message}>{message ?? page.message}</p>
      <div className={styles.actions}>
        {onRetry && (
          <button type="button" onClick={onRetry} disabled={retryDisabled}>
            <LuRefreshCw aria-hidden="true" />
            {' \u00dajrapr\u00f3b\u00e1lkoz\u00e1s'}
          </button>
        )}
        <Link to="/">
          <LuHouse aria-hidden="true" />
          {' Vissza a f\u0151oldalra'}
        </Link>
      </div>
      {retryStatus && (
        <p className={styles.status} role="status">
          {retryStatus}
        </p>
      )}
    </section>
  )
}
