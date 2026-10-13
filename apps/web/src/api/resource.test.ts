import { describe, expect, it, vi } from 'vitest'
import { cachedResource } from './resource'
import { deferred } from '../test/fixtures'

describe('statistics resource cache', () => {
  it('uses seeded values without renewing their original freshness', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const load = vi.fn(async () => 3)
      const resource = cachedResource(load)
      const signal = new AbortController().signal
      resource.remember('a', 2, Date.now() - 29_000)
      resource.remember('a', 1, Date.now() - 30_000)
      expect(await resource('a', signal)).toBe(2)
      expect(load).not.toHaveBeenCalled()
      vi.setSystemTime(Date.now() + 1000)
      expect(await resource('a', signal)).toBe(3)
      expect(load).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('aborts abandoned requests and never caches their late response', async () => {
    const response = deferred<number>()
    const load = vi.fn<(key: string, signal: AbortSignal) => Promise<number>>(
      () => response.promise,
    )
    const resource = cachedResource(load)
    const controller = new AbortController()
    const first = resource('a', controller.signal)
    const rejection = expect(first).rejects.toMatchObject({
      name: 'AbortError',
    })
    controller.abort()
    await rejection
    expect(load.mock.calls[0][1].aborted).toBe(true)
    response.resolve(2)
    await expect(resource('a', new AbortController().signal)).resolves.toBe(2)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('deduplicates subscribers and retains a successful result for 30 seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const load = vi.fn(async () => 42)
      const resource = cachedResource(load)
      const signal = new AbortController().signal
      expect(
        await Promise.all([resource('a', signal), resource('a', signal)]),
      ).toEqual([42, 42])
      expect(await resource('a', signal)).toBe(42)
      expect(load).toHaveBeenCalledTimes(1)
      vi.setSystemTime(Date.now() + 30_000)
      await resource('a', signal)
      expect(load).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels only after the last subscriber leaves', async () => {
    const result = deferred<number>()
    const load = vi.fn<(key: string, signal: AbortSignal) => Promise<number>>(
      () => result.promise,
    )
    const resource = cachedResource(load)
    const first = new AbortController(),
      second = new AbortController()
    const a = resource('a', first.signal),
      b = resource('a', second.signal)
    const rejection = expect(a).rejects.toMatchObject({ name: 'AbortError' })
    first.abort()
    await rejection
    expect(load.mock.calls[0][1].aborted).toBe(false)
    result.resolve(7)
    await expect(b).resolves.toBe(7)
  })

  it('does not cache failures and allows explicit retry invalidation', async () => {
    const load = vi
      .fn(async () => 1)
      .mockRejectedValueOnce(new Error('failure'))
    const resource = cachedResource(load)
    const signal = new AbortController().signal
    await expect(resource('a', signal)).rejects.toThrow('failure')
    await expect(resource('a', signal)).resolves.toBe(1)
    resource.invalidate('a')
    await resource('a', signal)
    expect(load).toHaveBeenCalledTimes(3)
  })
})
