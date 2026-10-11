import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ParityChart } from '.'
import { fixturePageData } from '../../test/fixtures'

vi.mock('@nivo/pie', () => ({
  ResponsivePie: ({ activeId }: { activeId: string | null }) => (
    <div data-testid="donut" data-active={activeId} />
  ),
}))
describe('parity occurrence shares', () => {
  it('provides exact shares and controls the active slice through focus and touch', () => {
    render(<ParityChart data={fixturePageData('five').parity.data} />)
    const even = screen.getByRole('button', { name: 'Páros: 2 · 40%' })
    fireEvent.focus(even)
    expect(even).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('donut')).toHaveAttribute('data-active', 'Páros')
    fireEvent.click(screen.getByRole('button', { name: 'Páratlan: 3 · 60%' }))
    expect(screen.getByTestId('donut')).toHaveAttribute(
      'data-active',
      'Páratlan',
    )
  })
  it('labels an empty denominator without drawing fabricated slices', () => {
    const data = fixturePageData('five').parity.data
    render(<ParityChart data={{ ...data, number_occurrence_count: 0 }} />)
    expect(
      screen.getByText('Nincs számelőfordulás ebben az időszakban.'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('donut')).not.toBeInTheDocument()
  })
})
