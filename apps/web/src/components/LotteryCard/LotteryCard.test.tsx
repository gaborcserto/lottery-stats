import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { fixtureResponses } from '../../test/fixtures'
import { LotteryCard } from './LotteryCard'

function renderCard(game: 'five' | 'six' | 'scandinavian') {
  return render(
    <MemoryRouter>
      <LotteryCard game={game} drawing={fixtureResponses(game).drawing.data} />
    </MemoryRouter>,
  )
}

function numbers(label: string) {
  return within(screen.getByLabelText(label))
    .getAllByRole('listitem')
    .map((ball) => ball.textContent)
}

describe('LotteryCard', () => {
  it('renders Ötöslottó numbers, Hungarian date, exact payout, and navigation', () => {
    renderCard('five')
    expect(
      screen.getByRole('heading', { name: 'Ötöslottó' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Ötöslottó logó' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Ötöslottó logó' })).toHaveAttribute(
      'src',
      '/images/logos/otoslotto.png',
    )
    expect(screen.getByText('2026. október 3.')).toBeInTheDocument()
    expect(numbers('Ötöslottó: Főszámok')).toEqual([
      '1',
      '12',
      '23',
      '34',
      '45',
    ])
    expect(
      screen.getByText(/9\s007\s199\s254\s740\s993,25 Ft/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/otoslotto')
  })

  it('keeps Scandinavian machine and manual numbers in separately labeled sets', () => {
    renderCard('scandinavian')
    expect(
      screen.getByRole('img', { name: 'Skandináv lottó logó' }),
    ).toHaveAttribute('src', '/images/logos/skandinav-lotto.png')
    expect(numbers('Skandináv lottó: Gépi számsor')).toEqual([
      '1',
      '5',
      '12',
      '23',
      '30',
      '34',
      '35',
    ])
    expect(numbers('Skandináv lottó: Kézi számsor')).toEqual([
      '2',
      '6',
      '13',
      '24',
      '29',
      '33',
      '35',
    ])
  })

  it('shows Hatoslottó bonus numbers separately when supplied', () => {
    const drawing = fixtureResponses('six').drawing.data
    drawing.sets.push({ type: 'bonus', numbers: [7] })
    render(
      <MemoryRouter>
        <LotteryCard game="six" drawing={drawing} />
      </MemoryRouter>,
    )
    expect(numbers('Hatoslottó: Főszámok')).toEqual([
      '1',
      '12',
      '23',
      '34',
      '44',
      '45',
    ])
    expect(numbers('Hatoslottó: Pótszám')).toEqual(['7'])
  })

  it('handles an unknown date and unavailable prize amount without inventing a value', () => {
    const drawing = fixtureResponses('five').drawing.data
    drawing.drawn_on = null
    drawing.prizes[0].amount = null
    render(
      <MemoryRouter>
        <LotteryCard game="five" drawing={drawing} />
      </MemoryRouter>,
    )
    expect(
      screen.getByText('A sorsolás dátuma nem ismert.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Az összeg nem ismert')).toBeInTheDocument()
    expect(screen.queryByText(/Ft/)).not.toBeInTheDocument()
  })

  it('shows the empty-result state and keeps the statistics link available', () => {
    render(
      <MemoryRouter>
        <LotteryCard game="six" drawing={null} />
      </MemoryRouter>,
    )
    expect(
      screen.getByText('Még nincs elérhető sorsolási adat.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/hatoslotto')
  })
})
