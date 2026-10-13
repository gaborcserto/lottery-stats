import { act, fireEvent, render, screen } from '@testing-library/react'
import { lazy, useEffect, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChartSlot } from '.'
import { deferred } from '../../test/fixtures'
import { ThemeProvider } from '../ThemeProvider'
import { ThemeSwitcher } from '../ThemeSwitcher'

afterEach(() => vi.unstubAllGlobals())
describe('viewport chart loading', () => {
  it('shows a chart skeleton while its module is pending and keeps the chart mounted through theme changes', async () => {
    const loaded = deferred<{ default: () => ReactNode }>()
    const mounted = vi.fn()
    function Chart() {
      useEffect(() => {
        mounted()
      }, [])
      return <p>Betöltött diagram</p>
    }
    const LazyChart = lazy(() => loaded.promise)
    render(
      <ThemeProvider>
        <ThemeSwitcher />
        <ChartSlot label="Gyakoriság">
          <LazyChart />
        </ChartSlot>
      </ThemeProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Az interaktív ábra betöltése…',
    )
    expect(
      screen.getByRole('status').querySelector('[aria-hidden="true"]'),
    ).toBeInTheDocument()
    await act(async () => loaded.resolve({ default: Chart }))
    const chart = screen.getByText('Betöltött diagram')
    fireEvent.click(screen.getByRole('button', { name: 'Sötét' }))
    expect(screen.getByText('Betöltött diagram')).toBe(chart)
    expect(mounted).toHaveBeenCalledTimes(1)
  })

  it('isolates a rejected chart module and preserves the tabular data and other charts', async () => {
    const failed = lazy(() => Promise.reject(new Error('private module URL')))
    const FailedChart = failed
    const caught = vi.fn()
    render(
      <>
        <ChartSlot label="Hibás diagram">
          <FailedChart />
        </ChartSlot>
        <table>
          <caption>Gyakoriság adatai</caption>
          <tbody>
            <tr>
              <th>12</th>
              <td>100%</td>
            </tr>
          </tbody>
        </table>
        <ChartSlot label="Másik diagram">
          <p>Másik ábra adatai</p>
        </ChartSlot>
      </>,
      { onCaughtError: caught },
    )
    await screen.findByText(/Az ábra nem tölthető be/)
    expect(screen.getByRole('button', { name: 'Újratöltés' })).toBeEnabled()
    expect(
      screen.getByRole('table', { name: 'Gyakoriság adatai' }),
    ).toHaveTextContent('100%')
    expect(screen.getByText('Másik ábra adatai')).toBeInTheDocument()
    expect(screen.queryByText('private module URL')).not.toBeInTheDocument()
    expect(caught).toHaveBeenCalledTimes(1)
  })

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

  it('keeps component-specific layout hooks on the shared chart slot', () => {
    const { container } = render(
      <ChartSlot className="parityChartSlot" label="Páros diagram">
        <p>Diagram</p>
      </ChartSlot>,
    )
    expect(container.firstElementChild).toHaveClass('parityChartSlot')
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
