import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChartMotion } from './useChartMotion'
import type { ResolvedTheme } from '../ThemeProvider'

describe('chart motion preferences', () => {
  it('disables Nivo motion when reduced motion is requested', () => {
    const original = window.matchMedia
    const mock = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation((query) => ({ ...original(query), matches: true }))
    const { result } = renderHook(() => useChartMotion('light'))
    expect(result.current).toBe(false)
    mock.mockRestore()
  })
  it('does not animate a theme update', () => {
    const { result, rerender } = renderHook(
      ({ theme }: { theme: ResolvedTheme }) => useChartMotion(theme),
      { initialProps: { theme: 'light' } },
    )
    expect(result.current).toBe(true)
    rerender({ theme: 'dark' })
    expect(result.current).toBe(false)
    rerender({ theme: 'light' })
    expect(result.current).toBe(false)
  })
})
