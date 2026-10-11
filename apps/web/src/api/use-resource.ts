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
    error?: string
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
    error: current?.error,
    loading: key !== null && !current,
    retry: () => {
      if (key !== null) load.invalidate?.(key)
      setResult((previous) =>
        previous?.key === key && previous.data
          ? { key, data: previous.data }
          : undefined,
      )
      setAttempt((value) => value + 1)
    },
  }
}
