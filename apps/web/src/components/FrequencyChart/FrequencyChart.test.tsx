import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FrequencyChart } from '.'
import { ThemeProvider } from '../ThemeProvider'
import { ThemeSwitcher } from '../ThemeSwitcher'

vi.mock('@nivo/bar', () => ({
  ResponsiveBar: ({
    data,
    theme,
    onMouseEnter,
    onMouseLeave,
    onClick,
  }: {
    data: { number: number; count: number; occurrence_percentage: number }[]
    theme: { text: { fill: string } }
    onMouseEnter: (bar: { data: (typeof data)[number] }) => void
    onMouseLeave: () => void
    onClick: (bar: { data: (typeof data)[number] }) => void
  }) => (
    <div>
      <output data-testid="chart-theme">{theme.text.fill}</output>
      {data.map((row) => (
        <button
          key={row.number}
          onMouseEnter={() => onMouseEnter({ data: row })}
          onMouseLeave={onMouseLeave}
          onClick={() => onClick({ data: row })}
        >
          {row.number}. oszlop
        </button>
      ))}
    </div>
  ),
}))

describe('frequency chart selection', () => {
  const data = [
    { number: 1, count: 185, occurrence_percentage: 5.1 },
    { number: 90, count: 0, occurrence_percentage: 0 },
  ]
  it('exposes exact API counts and percentages for hover, touch selection and native keyboard selection', () => {
    render(<FrequencyChart data={data} />)
    fireEvent.mouseEnter(screen.getByRole('button', { name: '1. oszlop' }))
    expect(
      screen.getByText('1. szám: 185 előfordulás · 5.1%'),
    ).toBeInTheDocument()
    fireEvent.mouseLeave(screen.getByRole('button', { name: '1. oszlop' }))
    fireEvent.click(screen.getByRole('button', { name: '90. oszlop' }))
    expect(screen.getByText('90. szám: 0 előfordulás · 0%')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } })
    fireEvent.mouseEnter(screen.getByRole('button', { name: '90. oszlop' }))
    fireEvent.mouseLeave(screen.getByRole('button', { name: '90. oszlop' }))
    expect(
      screen.getByText('1. szám: 185 előfordulás · 5.1%'),
    ).toBeInTheDocument()
  })

  it('updates the Nivo theme without clearing chart data or its selection', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
        <FrequencyChart data={data} />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '90. oszlop' }))
    expect(screen.getByText(/90\..*0%/)).toBeInTheDocument()
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Téma választása' }),
      ).getAllByRole('button')[1],
    )
    expect(screen.getByTestId('chart-theme')).toHaveTextContent('#ecf3ed')
    expect(
      screen.getByRole('button', { name: '90. oszlop' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/90\..*0%/)).toBeInTheDocument()
  })
})
