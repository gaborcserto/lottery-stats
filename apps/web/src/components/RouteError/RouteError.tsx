import { useEffect, useState } from 'react'
import {
  isRouteErrorResponse,
  useRevalidator,
  useRouteError,
} from 'react-router'
import { ApiError } from '../../api/client'
import { ErrorPage, getErrorPageTitle } from '../ErrorPage'

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
  const status =
    error instanceof ApiError
      ? (error.status ?? (error.kind === 'server' ? 500 : 503))
      : isRouteErrorResponse(error)
        ? error.status
        : 500
  const retryable =
    error instanceof ApiError
      ? ['network', 'server', 'rate-limit', 'invalid-response'].includes(
          error.kind,
        )
      : !isRouteErrorResponse(error) || status >= 500
  const retryStatus = waiting
    ? 'Az adatforrás várakozást kér az újabb lekérés előtt.'
    : revalidator.state !== 'idle'
      ? 'Adatok betöltése…'
      : undefined
  const message = error instanceof ApiError ? error.message : undefined
  return (
    <>
      <title>{`${getErrorPageTitle(status)} | Lottery Stats`}</title>
      <meta name="robots" content="noindex" />
      <ErrorPage
        status={status}
        message={
          status === 400 || status === 422
            ? 'Ellenőrizze a megadott szűrőket, majd próbálja újra.'
            : message
        }
        onRetry={retryable ? () => void revalidator.revalidate() : undefined}
        retryDisabled={waiting || revalidator.state !== 'idle'}
        retryStatus={retryStatus}
      />
    </>
  )
}
