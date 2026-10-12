import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PrizeBreakdown } from '.'
import type { Drawing } from '../../api/contracts'

describe('PrizeBreakdown', () => {
  it('presents higher prize tiers first without mutating the API data', () => {
    const prizes: Drawing['prizes'] = [
      { tier: 'match_3', winner_count: 2, amount: '1250.00', currency: 'HUF' },
      { tier: 'match_5', winner_count: 0, amount: '0.00', currency: 'HUF' },
      { tier: 'match_4', winner_count: null, amount: null, currency: null },
    ]
    render(<PrizeBreakdown prizes={prizes} />)
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(
      ['5 találat', '4 találat', '3 találat'],
    )
    expect(prizes.map((prize) => prize.tier)).toEqual([
      'match_3',
      'match_5',
      'match_4',
    ])
  })
  it('preserves exact HUF amounts and reports unknown amounts or currencies', () => {
    render(
      <PrizeBreakdown
        prizes={[
          {
            tier: 'match_5',
            winner_count: 1,
            amount: '9007199254740993.25',
            currency: 'HUF',
          },
          {
            tier: 'match_4',
            winner_count: null,
            amount: null,
            currency: null,
          },
          {
            tier: 'match_3',
            winner_count: 2,
            amount: '1250.00',
            currency: null,
          },
        ]}
      />,
    )

    expect(screen.getByText('5 találat').parentElement).toHaveTextContent(
      /9 007 199 254 740 993,25 Ft/,
    )
    expect(screen.getByText('4 találat').parentElement).toHaveTextContent(
      'Az összeg nem ismert',
    )
    expect(screen.getByText('3 találat').parentElement).toHaveTextContent(
      /1 250,00 \(a pénznem nem ismert\)/,
    )
  })
})
