import { act, render, screen } from '@testing-library/react'
import { lazy } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChartSlot } from '.'

afterEach(() => vi.unstubAllGlobals())
describe('viewport chart loading', () => {
  it('reserves a prerendered slot without importing chart code', () => {
    const load = vi.fn(async () => ({ default: () => <p>Ábra</p> }))
    const Chart = lazy(load)
    expect(
      renderToString(
        <ChartSlot label="Gyakoriság">
          <Chart />
        </ChartSlot>,
      ),
    ).toContain('Interaktív ábra')
    expect(load).not.toHaveBeenCalled()
  })
  it('loads only when near the viewport', async () => {
    let enter: (() => void) | undefined
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          callback: (entries: { isIntersecting: boolean }[]) => void,
        ) {
          enter = () => callback([{ isIntersecting: true }])
        }
        observe() {}
        disconnect = disconnect
      },
    )
    const load = vi.fn(async () => ({ default: () => <p>Betöltött ábra</p> }))
    const Chart = lazy(load)
    render(
      <ChartSlot label="Gyakoriság">
        <Chart />
      </ChartSlot>,
    )
    expect(load).not.toHaveBeenCalled()
    await act(async () => enter?.())
    expect(await screen.findByText('Betöltött ábra')).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalled()
  })
})
