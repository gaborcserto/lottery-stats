import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LatestDrawing } from '.'
import { fixtureResponses } from '../../test/fixtures'

describe('latest drawing', () => {
  it('keeps prize digits exact beyond floating-point precision', () => {
    render(<LatestDrawing drawing={fixtureResponses('five').drawing.data} />)
    expect(
      screen.getByText(/9\s007\s199\s254\s740\s993,25 Ft/),
    ).toBeInTheDocument()
  })
  it('keeps Scandinavian sets and historical bonus numbers distinct', () => {
    const drawing = fixtureResponses('scandinavian').drawing.data
    render(
      <LatestDrawing
        drawing={{
          ...drawing,
          drawn_on: null,
          sets: [...drawing.sets, { type: 'bonus', numbers: [7] }],
          prizes: [],
        }}
      />,
    )
    expect(screen.getByText('Gépi számsor')).toBeInTheDocument()
    expect(screen.getByText('Kézi számsor')).toBeInTheDocument()
    expect(screen.getByText('Pótszám')).toBeInTheDocument()
    expect(screen.getByText(/A sorsolás dátuma nem ismert/)).toBeInTheDocument()
    expect(
      screen.getByText('Nincs elérhető nyereményadat.'),
    ).toBeInTheDocument()
  })
  it('states missing drawings explicitly', () => {
    render(<LatestDrawing drawing={null} />)
    expect(
      screen.getByText('Még nincs elérhető sorsolási adat.'),
    ).toBeInTheDocument()
  })
})
