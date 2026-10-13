import { render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { GamePage } from '.'
import {
  decodeFrequenciesResponse,
  decodeParityResponse,
  decodeSummaryResponse,
} from '../../api/contracts'
import { fixtureResponses } from '../../test/fixtures'
import type { GameCode } from '../../api/contracts'
import type { GamePageData } from '../../api/page-data'

function pageData(game: GameCode): GamePageData {
  const fixture = fixtureResponses(game)
  return {
    latest: fixture.drawing.data,
    summary: decodeSummaryResponse(fixture.summary),
    frequencies: decodeFrequenciesResponse(fixture.frequencies),
    mostFrequent: decodeFrequenciesResponse(fixture.mostFrequencies),
    leastFrequent: decodeFrequenciesResponse(fixture.leastFrequencies),
    parity: decodeParityResponse(fixture.parity),
    history: [fixture.drawing.data],
    historyError: null,
    capturedAt: '2026-10-10T12:00:00Z',
  }
}

describe('game statistics pages', () => {
  it('shows empty rankings when no sets qualify and keeps genuine zero counts', () => {
    const data = pageData('five')
    data.frequencies.meta.eligible_set_count = 0
    data.mostFrequent.data = []
    data.leastFrequent.data = []
    const { rerender } = render(
      <MemoryRouter>
        <GamePage game="five" data={data} refreshing />
      </MemoryRouter>,
    )
    const most = screen.getByRole('heading', { name: 'Leggyakoribbak' })
    expect(most.parentElement).toHaveTextContent('Nincs adat.')
    expect(screen.getByText(/Az adatok frissítése/)).toHaveAttribute(
      'role',
      'status',
    )

    data.frequencies.meta.eligible_set_count = 1
    data.mostFrequent.data = [data.frequencies.data[0]]
    data.leastFrequent.data = [data.frequencies.data[1]]
    rerender(
      <MemoryRouter>
        <GamePage game="five" data={data} />
      </MemoryRouter>,
    )
    expect(screen.queryByText('Nincs adat.')).not.toBeInTheDocument()
    const least = screen.getByRole('heading', { name: 'Legritkábbak' })
    expect(least.parentElement).toHaveTextContent('(0)')
  })
  it.each([
    ['five', 'Ötöslottó', '/images/logos/otoslotto.png', '1, 12, 23, 34, 45'],
    [
      'six',
      'Hatoslottó',
      '/images/logos/hatoslotto.png',
      '1, 12, 23, 34, 44, 45',
    ],
    [
      'scandinavian',
      'Skandináv lottó',
      '/images/logos/skandinav-lotto.png',
      'Gépi számsor',
    ],
  ] as const)(
    'renders %s identity, results, stats and history in Hungarian',
    (game, title, logo, marker) => {
      const data = pageData(game)
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <GamePage game={game} data={data} />
        </MemoryRouter>,
      )
      const document = new DOMParser().parseFromString(html, 'text/html')
      expect(document.querySelector('h1')?.textContent).toBe(title)
      expect(document.querySelector(`img[src="${logo}"]`)).not.toBeNull()
      expect(document.body.textContent).toContain(marker)
      expect(document.body.textContent).toContain('Legutóbbi sorsolás')
      expect(document.body.textContent).toContain('Páros előfordulás')
      expect(document.body.textContent).toContain('Számsoronkénti megoszlás')
      expect(document.querySelector('table caption')?.textContent).toContain(
        title,
      )
      expect(document.querySelectorAll('ol li')).toHaveLength(1)
      expect(document.querySelector('a[href="/"]')).toBeNull()
    },
  )

  it('keeps Scandinavian machine and manual results separate', () => {
    render(
      <MemoryRouter>
        <GamePage game="scandinavian" data={pageData('scandinavian')} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Gépi számsor')).toBeInTheDocument()
    expect(screen.getByText('Kézi számsor')).toBeInTheDocument()
    expect(screen.getByText('2, 6, 13, 24, 29, 33, 35')).toBeInTheDocument()
    expect(
      screen.getByText(/az alapstatisztikák a gépi számsorokra vonatkoznak/),
    ).toBeInTheDocument()
  })

  it('keeps frequency badge counts beside their shared number-ball variants', () => {
    const data = pageData('five')
    render(
      <MemoryRouter>
        <GamePage game="five" data={data} />
      </MemoryRouter>,
    )

    const mostSection = screen.getByRole('heading', {
      name: 'Leggyakoribbak',
    }).parentElement
    const leastSection = screen.getByRole('heading', {
      name: 'Legritkábbak',
    }).parentElement
    if (!mostSection || !leastSection) throw new Error('Missing frequency list')
    const most = within(mostSection).getAllByRole('listitem')[0]
    const least = within(leastSection).getAllByRole('listitem')[0]
    if (!most || !least) throw new Error('Missing frequency badge')

    expect(most).toHaveTextContent(String(data.mostFrequent.data[0].number))
    expect(most).toHaveTextContent(String(data.mostFrequent.data[0].count))
    expect(least).toHaveTextContent(String(data.leastFrequent.data[0].number))
    expect(least).toHaveTextContent(String(data.leastFrequent.data[0].count))
    expect(most.querySelector('span')?.className).not.toBe(
      least.querySelector('span')?.className,
    )
  })

  it('keeps the statistics page visible when recent history is unavailable', () => {
    const data = pageData('five')
    data.history = []
    data.historyError = 'Az adatok átmenetileg nem érhetők el.'
    data.refreshError = 'Túl sok kérés.'
    render(
      <MemoryRouter>
        <GamePage game="five" data={data} />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: 'Számgyakoriság' }),
    ).toBeInTheDocument()
    const historySection = screen
      .getByRole('heading', { name: 'Korábbi eredmények' })
      .closest('section')
    if (!historySection) throw new Error('Missing history section')
    expect(
      within(historySection).getAllByText('Korábbi eredmények', {
        exact: true,
      }),
    ).toHaveLength(1)
    expect(
      within(historySection)
        .getByRole('heading', { name: 'Korábbi eredmények' })
        .querySelector('svg'),
    ).toBeInTheDocument()
    expect(within(historySection).getByRole('alert')).toHaveTextContent(
      data.historyError,
    )
    const refreshStatus = screen.getByText(/A frissítés nem sikerült/)
    expect(refreshStatus).toHaveAttribute('role', 'status')
    expect(refreshStatus).toHaveTextContent(
      'A korábban elérhető adatokat látod.',
    )
  })

  it.each(['five', 'six', 'scandinavian'] as const)(
    'gives every %s section heading one decorative icon and keeps prize context below its heading',
    (game) => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <GamePage game={game} data={pageData(game)} />
        </MemoryRouter>,
      )
      const document = new DOMParser().parseFromString(html, 'text/html')
      const headings = Array.from(document.querySelectorAll('h2'))
      expect(headings.length).toBeGreaterThan(0)
      for (const heading of headings) {
        expect(heading.querySelectorAll('svg')).toHaveLength(1)
        expect(heading.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
          'true',
        )
      }
      expect(document.querySelectorAll('#history-heading').length).toBe(1)
      const prizesHeading = document.querySelector('#prizes-heading')
      expect(prizesHeading?.textContent).toContain('Nyeremények')
      expect(prizesHeading?.nextElementSibling?.textContent).toBe(
        'Legutóbbi sorsolás',
      )
      expect(prizesHeading?.nextElementSibling?.tagName).toBe('P')
    },
  )

  it('shows Hatoslottó bonus only when the API provides a bonus set', () => {
    const data = pageData('six')
    data.latest = {
      ...data.latest!,
      sets: [...data.latest!.sets, { type: 'bonus', numbers: [9] }],
    }
    render(
      <MemoryRouter>
        <GamePage game="six" data={data} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Pótszámok')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Pótszámok' })).toHaveTextContent(
      '9',
    )
  })

  it('keeps exact HUF decimal strings and unknown amounts in prize presentation', () => {
    const data = pageData('five')
    data.latest = {
      ...data.latest!,
      prizes: [
        {
          tier: 'match_5',
          winner_count: 1,
          amount: '9007199254740993.25',
          currency: 'HUF',
        },
        { tier: 'match_4', winner_count: null, amount: null, currency: null },
        {
          tier: 'match_3',
          winner_count: 2,
          amount: '1250.00',
          currency: null,
        },
      ],
    }
    render(
      <MemoryRouter>
        <GamePage game="five" data={data} />
      </MemoryRouter>,
    )
    expect(screen.getByText('5 találat').parentElement?.textContent).toContain(
      '9 007 199 254 740 993,25 Ft',
    )
    expect(screen.getByText('Az összeg nem ismert')).toBeInTheDocument()
    expect(
      screen.getByText(/1 250,00 \(a pénznem nem ismert\)/),
    ).toBeInTheDocument()
  })

  it('formats four-digit counts consistently with prerendered Hungarian text', () => {
    const data = pageData('five')
    data.summary.data = { ...data.summary.data, drawing_count: 3631 }
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GamePage game="five" data={data} />
      </MemoryRouter>,
    )
    expect(html).toContain('<strong>3\u00a0631</strong>')
  })

  it('labels no history and renders the real frequency percentage denominator', () => {
    const data = pageData('scandinavian')
    data.latest = null
    data.history = []
    data.summary.data = {
      ...data.summary.data,
      drawing_count: 0,
      eligible_set_count: 0,
    }
    data.frequencies.meta = { ...data.frequencies.meta, eligible_set_count: 0 }
    render(
      <MemoryRouter>
        <GamePage game="scandinavian" data={data} />
      </MemoryRouter>,
    )
    expect(
      screen.getByText('Még nincs elérhető történeti sorsolás.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Még nincs megjeleníthető sorsolás.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/nevezője a/).length).toBeGreaterThan(0)
  })
})
