// Each resource owns its typed cache. Subscribers share work; only the last
// cancellation aborts the underlying fetch, including during fast navigation.
export function cachedResource<T>(
  load: (key: string, signal: AbortSignal) => Promise<T>,
) {
  const cache = new Map<string, { value: T; time: number }>()
  const pending = new Map<
    string,
    { controller: AbortController; promise: Promise<T>; subscribers: number }
  >()
  const request = (key: string, signal: AbortSignal): Promise<T> => {
    signal.throwIfAborted()
    const hit = cache.get(key)
    if (hit && Date.now() - hit.time < 30_000) return Promise.resolve(hit.value)
    let entry = pending.get(key)
    if (!entry || entry.controller.signal.aborted) {
      const controller = new AbortController()
      const promise = load(key, controller.signal)
        .then((value) => {
          controller.signal.throwIfAborted()
          cache.set(key, { value, time: Date.now() })
          if (cache.size > 40) {
            const oldest = cache.keys().next().value
            if (oldest !== undefined) cache.delete(oldest)
          }
          return value
        })
        .finally(() => {
          if (pending.get(key)?.controller === controller) pending.delete(key)
        })
      entry = { controller, promise, subscribers: 0 }
      pending.set(key, entry)
    }
    const current = entry
    current.subscribers++
    return new Promise<T>((resolve, reject) => {
      let finished = false
      const release = () => {
        if (finished) return
        finished = true
        signal.removeEventListener('abort', abort)
        current.subscribers--
        if (!current.subscribers) current.controller.abort()
      }
      const abort = () => {
        release()
        reject(signal.reason)
      }
      signal.addEventListener('abort', abort, { once: true })
      current.promise.then(
        (value) => {
          if (!finished) {
            release()
            resolve(value)
          }
        },
        (error) => {
          if (!finished) {
            release()
            reject(error)
          }
        },
      )
    })
  }
  return Object.assign(request, {
    invalidate: (key: string) => cache.delete(key),
  })
}
