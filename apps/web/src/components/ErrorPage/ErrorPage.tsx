import { Link } from 'react-router'
import { LuHouse, LuRefreshCw } from 'react-icons/lu'
import { getErrorPage } from './errorPages'
import styles from './ErrorPage.module.scss'

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
  const page = getErrorPage(status)

  return (
    <section className={styles.error} aria-labelledby="error-heading">
      <p className={styles.code}>
        <span>{status}</span>
        <span
          className={styles.codeLayers}
          data-text={status}
          aria-hidden="true"
        />
      </p>
      <h1 id="error-heading">{page.title}</h1>
      <p className={styles.message}>{message ?? page.message}</p>
      <div className={styles.actions}>
        {onRetry && (
          <button type="button" onClick={onRetry} disabled={retryDisabled}>
            <LuRefreshCw aria-hidden="true" />
            {' \u00dajrapr\u00f3b\u00e1lkoz\u00e1s'}
          </button>
        )}
        <Link to="/" className={onRetry ? styles.secondary : undefined}>
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
