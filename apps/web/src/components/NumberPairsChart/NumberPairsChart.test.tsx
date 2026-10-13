import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NumberPairsChart } from '.'

vi.mock('@nivo/bar', () => ({
  ResponsiveBar: ({
    data,
    onClick,
  }: {
    data: {
      pair: string
      count: number
      occurrence_percentage: number
    }[]
    onClick: (bar: { data: { pair: string } }) => void
  }) => (
    <div>
      {data.map((row) => (
        <button
          key={row.pair}
          aria-label={`${row.pair}: ${row.count} előfordulás, ${row.occurrence_percentage}%`}
          onClick={() => onClick({ data: row })}
        >
          {row.pair}: {row.count}
        </button>
      ))}
    </div>
  ),
}))
describe('pair chart data and selection', () => {
  it('toggles pair emphasis through chart selection and the native selection control', () => {
    render(
      <NumberPairsChart
        data={[
          {
            first_number: 3,
            second_number: 19,
            count: 31,
            occurrence_percentage: 0.85,
          },
        ]}
      />,
    )
    const chartItem = screen.getByRole('button', {
      name: '3 + 19: 31 előfordulás, 0.85%',
    })
    expect(chartItem).toBeInTheDocument()
    fireEvent.click(chartItem)
    expect(screen.getByRole('combobox')).toHaveValue('3 + 19')
    expect(screen.getByText('· 31 előfordulás · 0.85%')).toBeInTheDocument()
    fireEvent.click(chartItem)
    expect(screen.getByRole('combobox')).toHaveValue('')
    expect(
      screen.queryByText('· 31 előfordulás · 0.85%'),
    ).not.toBeInTheDocument()
    fireEvent.keyDown(chartItem, { key: 'Enter' })
    expect(screen.getByRole('combobox')).toHaveValue('3 + 19')
    fireEvent.keyDown(chartItem, { key: ' ' })
    expect(screen.getByRole('combobox')).toHaveValue('')
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '3 + 19' },
    })
    expect(screen.getByRole('combobox')).toHaveValue('3 + 19')
  })
})
