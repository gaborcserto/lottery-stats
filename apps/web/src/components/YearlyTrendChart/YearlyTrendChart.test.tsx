import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fixturePageData } from '../../test/fixtures'
import { ThemeProvider } from '../ThemeProvider'
import { ThemeSwitcher } from '../ThemeSwitcher'
import { YearlyTrendChart } from './YearlyTrendChart'

vi.mock('@nivo/line', () => ({
  ResponsiveLine: ({
    data,
    colors,
    theme,
  }: {
    data: { id: string }[]
    colors: string[]
    theme: { text: { fill: string } }
  }) => (
    <>
      <output data-testid="series">
        {data.map((series) => series.id).join(',')}
      </output>
      <output data-testid="colors">{colors.join(',')}</output>
      <output data-testid="theme">{theme.text.fill}</output>
    </>
  ),
}))

describe('yearly trend chart', () => {
  it('shows multiple selected series and preserves them when the theme changes', () => {
    const yearly = fixturePageData('five').yearly
    if (!yearly) throw new Error('Missing yearly fixture')
    render(
      <ThemeProvider>
        <ThemeSwitcher />
        <YearlyTrendChart
          series={[
            { number: 1, data: yearly.data },
            { number: 12, data: yearly.data },
          ]}
        />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('series')).toHaveTextContent('1. szám,12. szám')
    expect(screen.getByTestId('colors').textContent?.split(',')[0]).toBe(
      'var(--accent-lime)',
    )
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Téma választása' }),
      ).getAllByRole('button')[1],
    )
    expect(screen.getByTestId('theme')).toHaveTextContent('#edf3f8')
    expect(screen.getByTestId('series')).toHaveTextContent('1. szám,12. szám')
  })
})
