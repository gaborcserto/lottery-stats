import { fireEvent, render, screen, within } from '@testing-library/react'
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
    const yearlyDisclosure = Array.from(
      document.querySelectorAll('summary'),
    ).find(
      (summary) =>
        summary.textContent === 'Részletes éves adatok megjelenítése',
    )
    if (!yearlyDisclosure) throw new Error('Missing yearly table disclosure')
    expect(yearlyDisclosure.closest('details')?.hasAttribute('open')).toBe(
      false,
    )
    expect(yearlyDisclosure.textContent).toBe(
      'Részletes éves adatok megjelenítése',
    )
    expect(document.body.textContent).toContain('1. szám éves előfordulásai')
    expect(document.body.textContent).toContain('1 + 12')
    expect(
      document.querySelectorAll('svg:not([aria-hidden="true"])'),
    ).toHaveLength(0)
  })

  it('keeps the complete yearly table in an accessible collapsed disclosure', () => {
    const data = fixturePageData('five')
    render(
      <MemoryRouter>
        <StatisticsDetails
          game="five"
          data={data}
          filters={parseFilters(new URLSearchParams(), 'five')}
          hydrated={false}
        />
      </MemoryRouter>,
    )

    const disclosure = screen.getByText('Részletes éves adatok megjelenítése')
    const details = disclosure.closest('details')
    if (!details) throw new Error('Missing yearly table disclosure')
    expect(details.open).toBe(false)
    expect(within(details).getByRole('table')).toBeInTheDocument()

    fireEvent.click(disclosure)

    expect(details.open).toBe(true)
    expect(within(details).getByRole('table')).toBeInTheDocument()
    expect(within(details).getAllByRole('row').length).toBe(
      (data.yearly?.data.length ?? 0) + 1,
    )
  })

  it.each([
    ['Év', 'Év', ['2024', '2025', '2026'], ['2026', '2025', '2024']],
    ['Előfordulás', 'Előfordulás', ['1', '2', '10'], ['10', '2', '1']],
    [
      'Vizsgált számsor',
      'Vizsgált számsor',
      ['5', '20', '100'],
      ['100', '20', '5'],
    ],
    ['Arány', 'Arány', ['2%', '9%', '100%'], ['100%', '9%', '2%']],
  ])(
    'sorts yearly rows both ways by %s',
    (_name, label, ascending, descending) => {
      const data = fixturePageData('five')
      if (!data.yearly) throw new Error('Missing yearly fixture')
      data.yearly.data = [
        {
          year: 2024,
          drawing_count: 1,
          eligible_set_count: 5,
          number_occurrence_count: 1,
          selected_number_count: 1,
          selected_number_occurrence_percentage: 2,
        },
        {
          year: 2025,
          drawing_count: 1,
          eligible_set_count: 20,
          number_occurrence_count: 2,
          selected_number_count: 2,
          selected_number_occurrence_percentage: 9,
        },
        {
          year: 2026,
          drawing_count: 1,
          eligible_set_count: 100,
          number_occurrence_count: 10,
          selected_number_count: 10,
          selected_number_occurrence_percentage: 100,
        },
      ]
      render(
        <MemoryRouter>
          <StatisticsDetails
            game="five"
            data={data}
            filters={parseFilters(new URLSearchParams(), 'five')}
            hydrated={false}
          />
        </MemoryRouter>,
      )
      fireEvent.click(screen.getByText('Részletes éves adatok megjelenítése'))
      const table = screen.getByRole('table', {
        name: '1. szám éves előfordulásai',
      })
      const header = within(table).getByRole('button', {
        name: new RegExp(label),
      })
      const columnIndex = [
        'Év',
        'Előfordulás',
        'Vizsgált számsor',
        'Arány',
      ].indexOf(label)
      expect(
        within(table)
          .getAllByRole('row')
          .slice(1)
          .map((row) => (row as HTMLTableRowElement).cells[0]?.textContent),
      ).toEqual(['2026', '2025', '2024'])
      if (label === 'Év') {
        expect(header.closest('th')).toHaveAttribute('aria-sort', 'descending')
      }
      fireEvent.click(header)
      expect(
        within(table)
          .getAllByRole('row')
          .slice(1)
          .map(
            (row) =>
              (row as HTMLTableRowElement).cells[columnIndex]?.textContent,
          ),
      ).toEqual(ascending)
      expect(header.closest('th')).toHaveAttribute('aria-sort', 'ascending')
      fireEvent.click(header)
      expect(
        within(table)
          .getAllByRole('row')
          .slice(1)
          .map(
            (row) =>
              (row as HTMLTableRowElement).cells[columnIndex]?.textContent,
          ),
      ).toEqual(descending)
      expect(header.closest('th')).toHaveAttribute('aria-sort', 'descending')

      if (label !== 'Év') {
        const yearHeader = within(table).getByRole('button', { name: /Év/ })
        fireEvent.click(yearHeader)
        expect(yearHeader.closest('th')).toHaveAttribute(
          'aria-sort',
          'descending',
        )
        expect(
          within(table)
            .getAllByRole('row')
            .slice(1)
            .map((row) => (row as HTMLTableRowElement).cells[0]?.textContent),
        ).toEqual(['2026', '2025', '2024'])
      }
    },
  )

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

  it('supports keyboard operation of the native disclosure summary', () => {
    render(
      <MemoryRouter>
        <StatisticsDetails
          game="five"
          data={fixturePageData('five')}
          filters={parseFilters(new URLSearchParams(), 'five')}
          hydrated={false}
        />
      </MemoryRouter>,
    )
    const summary = screen
      .getByText('Részletes éves adatok megjelenítése')
      .closest('summary')
    if (!summary) throw new Error('Missing yearly disclosure summary')
    summary.focus()
    expect(summary).toHaveFocus()
    expect(summary.closest('details')).not.toHaveAttribute('open')
    fireEvent.keyDown(summary, { key: 'Enter' })
    fireEvent.click(summary)
    expect(summary.closest('details')).toHaveAttribute('open')
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
