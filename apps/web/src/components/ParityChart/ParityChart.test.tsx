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
  it('toggles an accessible parity selection with pointer and keyboard activation', () => {
    render(<ParityChart data={fixturePageData('five').parity.data} />)
    const even = screen.getByRole('button', { name: 'Páros: 2 · 40%' })
    fireEvent.focus(even)
    expect(even).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(even)
    expect(even).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('donut')).toHaveAttribute('data-active', 'Páros')
    fireEvent.click(even)
    expect(even).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('donut')).not.toHaveAttribute('data-active')
    fireEvent.click(screen.getByRole('button', { name: 'Páratlan: 3 · 60%' }))
    expect(screen.getByTestId('donut')).toHaveAttribute(
      'data-active',
      'Páratlan',
    )
    expect(even).toHaveAttribute('aria-pressed', 'false')
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
