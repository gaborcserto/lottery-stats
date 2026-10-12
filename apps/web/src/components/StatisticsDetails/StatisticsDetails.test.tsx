import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { StatisticsDetails } from '.'
import { parseFilters } from '../../api/filters'
import { fixturePageData } from '../../test/fixtures'

describe('accessible chart alternatives', () => {
  it('prerenders annual and pair tables without importing chart code', () => {
    const data = fixturePageData('five')
    const html = renderToString(
      <MemoryRouter>
        <StatisticsDetails
          game="five"
          data={data}
          filters={parseFilters(new URLSearchParams(), 'five')}
          hydrated={false}
        />
      </MemoryRouter>,
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    expect(document.querySelectorAll('table')).toHaveLength(2)
    expect(document.body.textContent).toContain('1. szám éves előfordulásai')
    expect(document.body.textContent).toContain('1 + 12')
    expect(document.querySelectorAll('div[aria-label] svg')).toHaveLength(0)
  })
  it('keeps other chart data visible on an independent API failure', () => {
    const data = fixturePageData('six')
    delete data.pairs
    data.pairsError = 'Az adatok átmenetileg nem érhetők el.'
    render(
      <MemoryRouter>
        <StatisticsDetails
          game="six"
          data={data}
          filters={parseFilters(new URLSearchParams(), 'six')}
          hydrated
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(data.pairsError)
    expect(
      screen.getByRole('button', { name: 'Újrapróbálkozás' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: '1. szám éves előfordulásai' }),
    ).toBeInTheDocument()
  })
  it('labels empty filtered populations instead of fabricating chart values', () => {
    const data = fixturePageData('scandinavian')
    if (!data.pairs || !data.yearly) throw new Error('Missing fixtures')
    data.pairs.data = []
    data.yearly.data = []
    render(
      <MemoryRouter>
        <StatisticsDetails
          game="scandinavian"
          data={data}
          filters={parseFilters(new URLSearchParams(), 'scandinavian')}
          hydrated
        />
      </MemoryRouter>,
    )
    expect(
      screen.getByText('Nincs éves adat a kiválasztott időszakban.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Nincs megfigyelt számpár a kiválasztott időszakban.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
