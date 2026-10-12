import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HistoryPagination } from '.'

describe('drawing history pagination', () => {
  it('supports arbitrary middle pages, adjacent pages and first/last navigation', () => {
    const change = vi.fn()
    render(<HistoryPagination current={303} last={727} onPageChange={change} />)
    expect(screen.getByRole('button', { name: '303. oldal' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getAllByText('…')).toHaveLength(2)
    for (const label of [
      'Első oldal',
      'Előző oldal',
      'Következő oldal',
      'Utolsó oldal',
    ])
      expect(
        screen.getByRole('button', { name: label }).querySelector('svg'),
      ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '303. oldal' }).querySelector('svg'),
    ).not.toBeInTheDocument()
    for (const [label, page] of [
      ['Első oldal', 1],
      ['Előző oldal', 302],
      ['302. oldal', 302],
      ['304. oldal', 304],
      ['Következő oldal', 304],
      ['Utolsó oldal', 727],
      ['727. oldal', 727],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(change).toHaveBeenLastCalledWith(page)
    }
  })
  it.each([1, 2, 726, 727])(
    'shows valid unique numbered pages near edge %s',
    (current) => {
      render(
        <HistoryPagination
          current={current}
          last={727}
          onPageChange={vi.fn()}
        />,
      )
      const numbered = screen
        .getAllByRole('button')
        .filter((button) =>
          /^\d+\. oldal$/.test(button.getAttribute('aria-label') ?? ''),
        )
      const labels = numbered.map((button) => button.getAttribute('aria-label'))
      expect(new Set(labels).size).toBe(labels.length)
      expect(screen.getByRole('button', { name: 'Első oldal' })).toHaveProperty(
        'disabled',
        current === 1,
      )
      expect(
        screen.getByRole('button', { name: 'Előző oldal' }),
      ).toHaveProperty('disabled', current === 1)
      expect(
        screen.getByRole('button', { name: 'Utolsó oldal' }),
      ).toHaveProperty('disabled', current === 727)
      expect(
        screen.getByRole('button', { name: 'Következő oldal' }),
      ).toHaveProperty('disabled', current === 727)
    },
  )
  it('disables unavailable and pending controls', () => {
    const { rerender } = render(
      <HistoryPagination current={1} last={1} onPageChange={vi.fn()} />,
    )
    expect(
      screen
        .getAllByRole('button')
        .filter((button) => !button.hasAttribute('disabled')),
    ).toHaveLength(1)
    rerender(
      <HistoryPagination current={10} last={727} busy onPageChange={vi.fn()} />,
    )
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-busy', 'true')
    for (const button of screen.getAllByRole('button'))
      expect(button).toBeDisabled()
  })
})
