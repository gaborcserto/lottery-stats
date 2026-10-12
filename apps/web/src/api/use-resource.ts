import { useEffect, useState } from 'react'
import { ApiError } from './client'

export function useResource<T>(
  key: string | null,
  load: ((key: string, signal: AbortSignal) => Promise<T>) & {
    invalidate?: (key: string) => unknown
  },
) {
  const [result, setResult] = useState<{
    key: string
    data?: T
    previousData?: T
    error?: string
    pending?: boolean
  }>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    void load(key, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ key, data })
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            key,
            data: previous?.key === key ? previous.data : undefined,
            previousData:
              previous?.key === key
                ? previous.previousData
                : (previous?.data ?? previous?.previousData),
            error:
              error instanceof ApiError
                ? error.message
                : 'Az adatok betöltése nem sikerült.',
          }))
      },
    )
    return () => controller.abort()
  }, [key, load, attempt])
  const current = result?.key === key ? result : undefined
  return {
    data: current?.data,
    previousData:
      current?.previousData ??
      (result?.key !== key
        ? (result?.data ?? result?.previousData)
        : undefined),
    error: current?.error,
    loading: key !== null && (!current || current.pending === true),
    retry: () => {
      if (key === null) return
      const retryKey = key
      load.invalidate?.(retryKey)
      setResult((previous) =>
        previous?.key === retryKey
          ? {
              key: retryKey,
              data: previous.data,
              previousData: previous.previousData,
              pending: true,
            }
          : previous
            ? {
                key: retryKey,
                previousData: previous.data ?? previous.previousData,
                pending: true,
              }
            : undefined,
      )
      setAttempt((value) => value + 1)
    },
  }
}
