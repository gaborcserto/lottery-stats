import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GamePage } from '.'
import {
  decodeFrequenciesResponse,
  decodeSummaryResponse,
} from '../../api/contracts'
import { fixtureResponses } from '../../test/fixtures'

const fixture = fixtureResponses('scandinavian')
const data = {
  latest: fixture.drawing.data,
  summary: decodeSummaryResponse(fixture.summary),
  frequencies: decodeFrequenciesResponse(fixture.frequencies),
  capturedAt: '2026-10-10T12:00:00Z',
}
describe('prerendered game content', () => {
  it('renders real decoded data, scope and denominator in Hungarian before JavaScript', () => {
    const html = renderToStaticMarkup(
      <GamePage game="scandinavian" data={data} />,
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    expect(document.querySelector('h1')?.textContent).toBe(
      'Skandináv lottó eredmények és statisztikák',
    )
    expect(document.querySelector('dl')?.textContent).toContain(
      '1, 5, 12, 23, 30, 34, 35',
    )
    expect(document.querySelector('table')?.textContent).toContain(
      'Számsorok aránya',
    )
    expect(document.body.textContent).toContain(
      'A százalékok nevezője: 1 megfelelő gépi számsor',
    )
  })
  it('labels an empty population instead of treating zero percentages as evidence', () => {
    render(
      <GamePage
        game="scandinavian"
        data={{
          ...data,
          latest: null,
          summary: {
            ...data.summary,
            data: {
              ...data.summary.data,
              drawing_count: 0,
              eligible_set_count: 0,
            },
          },
        }}
      />,
    )
    expect(
      screen.getByText('Még nincs elérhető történelmi sorsolás.'),
    ).toBeInTheDocument()
  })
})
