import { useEffect, useState } from 'react'
import {
  isRouteErrorResponse,
  useRevalidator,
  useRouteError,
} from 'react-router'
import { ApiError } from '../../api/client'
import { ErrorPage } from '../ErrorPage'
import styles from './RouteError.module.scss'

export function RouteError() {
  const error: unknown = useRouteError()
  const revalidator = useRevalidator()
  const retryAt = error instanceof ApiError ? error.retryAt : undefined
  const [waiting, setWaiting] = useState(
    () => retryAt !== undefined && retryAt > Date.now(),
  )
  useEffect(() => {
    if (retryAt === undefined) return
    const timer = window.setTimeout(
      () => setWaiting(false),
      Math.max(0, retryAt - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [retryAt])
  const missing = isRouteErrorResponse(error) && error.status === 404
  return (
    <>
      <title>{`${missing ? 'Az oldal nem található' : 'Az adatok nem érhetők el'} | Lottery Stats`}</title>
      <meta name="robots" content="noindex" />
      <ErrorPage
        missing={missing}
        message={error instanceof ApiError ? error.message : undefined}
      />
      {!missing && (
        <div className={styles.retry}>
          <button
            type="button"
            disabled={waiting || revalidator.state !== 'idle'}
            onClick={() => void revalidator.revalidate()}
          >
            Újrapróbálkozás
          </button>
          {waiting && (
            <p role="status">
              Az adatforrás várakozást kér az újabb lekérés előtt.
            </p>
          )}
          {revalidator.state !== 'idle' && (
            <p role="status">Adatok betöltése…</p>
          )}
        </div>
      )}
    </>
  )
}
