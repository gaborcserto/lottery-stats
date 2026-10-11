import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NumberPairsChart } from '.'

vi.mock('@nivo/bar', () => ({
  ResponsiveBar: ({ data }: { data: { pair: string; count: number }[] }) => (
    <div>
      {data.map((row) => (
        <span key={row.pair}>
          {row.pair}: {row.count}
        </span>
      ))}
    </div>
  ),
}))
describe('pair chart data and selection', () => {
  it('maps both numbers and exposes exact counts and percentages through native selection', () => {
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
    expect(screen.getByText('3 + 19: 31')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '3 + 19' },
    })
    expect(screen.getByText('· 31 előfordulás · 0.85%')).toBeInTheDocument()
  })
})
