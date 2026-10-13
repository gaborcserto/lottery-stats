import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Root from '../../root'
import { GamePage } from '.'
import type { GameCode } from '../../api/contracts'
import {
  deferred,
  fixtureApiResponse,
  fixturePageData,
} from '../../test/fixtures'

const routers: ReturnType<typeof createMemoryRouter>[] = []
let time = Date.parse('2027-01-01T00:00:00Z')
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  time += 120_000
  vi.setSystemTime(time)
  localStorage.clear()
})
afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose())
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.clear()
})

function setup(game: GameCode = 'scandinavian', search = '') {
  const fetcher = vi.fn<typeof fetch>(async (input) =>
    fixtureApiResponse(String(input)),
  )
  vi.stubGlobal('fetch', fetcher)
  const router = createMemoryRouter(
    [
      {
        Component: Root,
        children: [
          {
            path: '/game',
            element: <GamePage game={game} data={fixturePageData(game)} />,
          },
        ],
      },
    ],
    { initialEntries: [`/game${search}`] },
  )
  routers.push(router)
  render(<RouterProvider router={router} />)
  return { router, fetcher }
}

function filterForm() {
  const form = screen
    .getByLabelText('Statisztikai szűrők')
    .querySelector('form')
  if (!form) throw new Error('Missing filters form')
  return within(form)
}

function frequencyTable() {
  return screen.getByRole('table', { name: /előfordulások és a vizsgált/ })
}

describe('statistics user journeys through the typed API client', () => {
  it('keeps one trend selection and disables both removal controls accessibly', async () => {
    const { router, fetcher } = setup('six', '?number=12')
    await screen.findByRole('table', {
      name: '12. szám éves előfordulásai',
    })
    const chips = screen.getByRole('list', { name: 'Kiválasztott számok' })
    const removal = within(chips).getByRole('button', {
      name: '12. szám eltávolítása',
    })
    expect(removal).toBeDisabled()
    expect(
      screen.getByText(
        'Legalább 1 számot kell kiválasztani az összehasonlításhoz.',
      ),
    ).toHaveAttribute('role', 'status')
    const checkbox = screen.getByRole('checkbox', { name: '12. szám' })
    expect(checkbox).toBeDisabled()
    const count = fetcher.mock.calls.length
    fireEvent.click(removal)
    fireEvent.click(checkbox)
    expect(router.state.location.search).toBe('?number=12')
    expect(fetcher).toHaveBeenCalledTimes(count)
  })

  it('bounds oversized trend URLs and reports yearly API failures safely', async () => {
    const query = Array.from(
      { length: 35 },
      (_, index) => `number=${index + 1}`,
    ).join('&')
    const { fetcher } = setup('scandinavian', `?${query}`)
    await screen.findByRole('table', { name: /éves előfordulásai/i })
    const yearlyCalls = fetcher.mock.calls.filter(([input]) =>
      String(input).includes('/trends/yearly'),
    )
    expect(yearlyCalls.length).toBeLessThanOrEqual(9)
    expect(
      screen.getByText('Legfeljebb 10 szám hasonlítható össze egyszerre.'),
    ).toBeInTheDocument()

    fetcher.mockImplementation(async (input) =>
      String(input).includes('/trends/yearly')
        ? Response.json({}, { status: 503 })
        : fixtureApiResponse(String(input)),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /^1\. szám eltávolítása$/ }),
    )
    fireEvent.click(screen.getByRole('checkbox', { name: '11. szám' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Az adatok átmenetileg nem érhetők el')
    expect(alert).not.toHaveTextContent('private')
  })

  it('retains selected numbers while population filters load and fail', async () => {
    const { fetcher } = setup('six', '?number=1&number=12')
    await screen.findByRole('table', {
      name: '12. szám éves előfordulásai',
    })
    const pending = deferred<Response>()
    fetcher.mockImplementation(async (input) =>
      String(input).includes('/summary')
        ? pending.promise
        : fixtureApiResponse(String(input)),
    )
    fireEvent.change(filterForm().getByLabelText('Év'), {
      target: { value: '2020' },
    })
    fireEvent.click(filterForm().getByRole('button', { name: 'Szűrés' }))
    const chips = screen.getByRole('list', { name: 'Kiválasztott számok' })
    expect(within(chips).getAllByRole('listitem')).toHaveLength(2)
    await act(async () => pending.resolve(Response.json({}, { status: 503 })))
    await screen.findByRole('alert')
    expect(within(chips).getAllByRole('listitem')).toHaveLength(2)
    expect(filterForm().getByLabelText('Év')).toHaveValue(2020)
  })

  it.each([false, true])(
    'restores keyboard submit focus after an uncached filter loads unless focus moved elsewhere (%s)',
    async (moveFocusDuringLoading) => {
      const { fetcher, router } = setup('five')
      const pendingSummary = deferred<Response>()
      let summaryInput = ''
      fetcher.mockImplementation(async (input) => {
        const url = new URL(String(input), 'http://fixture.test')
        if (
          url.pathname.endsWith('/summary') &&
          url.searchParams.get('year') === '2024'
        ) {
          summaryInput = String(input)
          return pendingSummary.promise
        }
        return fixtureApiResponse(String(input))
      })

      fireEvent.change(filterForm().getByLabelText('Év'), {
        target: { value: '2024' },
      })
      const submit = filterForm().getByRole('button', { name: 'Szűrés' })
      submit.focus()
      fireEvent.keyDown(submit, { key: 'Enter' })
      const form = submit.closest('form')
      if (!form) throw new Error('Missing filters form')
      form.requestSubmit(submit)

      const loadingSubmit = await screen.findByRole('button', {
        name: 'Szűrés folyamatban…',
      })
      expect(loadingSubmit).toBeDisabled()
      expect(router.state.location.search).toBe('?year=2024&sort=number')
      if (moveFocusDuringLoading) filterForm().getByLabelText('Év').focus()

      await act(async () =>
        pendingSummary.resolve(await fixtureApiResponse(summaryInput)),
      )
      const enabledSubmit = await screen.findByRole('button', {
        name: 'Szűrés',
      })
      if (moveFocusDuringLoading)
        expect(filterForm().getByLabelText('Év')).toHaveFocus()
      else expect(enabledSubmit).toHaveFocus()
    },
  )

  it.each(['network', 'invalid-response'] as const)(
    'clears pending feedback and retains safe data on %s failure',
    async (failure) => {
      const { fetcher } = setup('five')
      fetcher.mockImplementation(async (input) => {
        if (String(input).includes('/summary')) {
          if (failure === 'network') throw new TypeError('private hostname')
          return Response.json({ private: 'unexpected payload' })
        }
        return fixtureApiResponse(String(input))
      })
      fireEvent.change(filterForm().getByLabelText('Év'), {
        target: { value: '2019' },
      })
      fireEvent.click(filterForm().getByRole('button', { name: 'Szűrés' }))
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        failure === 'network'
          ? 'Nem sikerült kapcsolódni'
          : 'Az adatforrás válasza nem értelmezhető',
      )
      expect(alert).not.toHaveTextContent('private')
      expect(filterForm().getByRole('button', { name: 'Szűrés' })).toBeEnabled()
      expect(frequencyTable()).toBeInTheDocument()
    },
  )

  it('resets an empty filtered result to the default data without another request', async () => {
    const { fetcher, router } = setup('five')
    fetcher.mockImplementation(async (input) => {
      const response = fixtureApiResponse(String(input))
      if (!String(input).includes('/summary')) return response
      const body: unknown = await response.json()
      if (typeof body !== 'object' || body === null || !('meta' in body))
        throw new Error('Invalid fixture')
      return Response.json({
        ...body,
        data: {
          drawing_count: 0,
          eligible_set_count: 0,
          min_year: null,
          max_year: null,
          from_date: null,
          to_date: null,
          undated_drawing_count: 0,
        },
      })
    })
    fireEvent.change(filterForm().getByLabelText('Év'), {
      target: { value: '1800' },
    })
    fireEvent.click(filterForm().getByRole('button', { name: 'Szűrés' }))
    await screen.findByText(
      'Nincs sorsolás a kiválasztott szűrőknek megfelelően.',
      { exact: false },
    )
    const count = fetcher.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Szűrők törlése' }))
    expect(router.state.location.search).toBe('')
    expect(
      screen.queryByText(
        'Nincs sorsolás a kiválasztott szűrőknek megfelelően.',
        { exact: false },
      ),
    ).not.toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(count)
  })

  it('applies intersected dates/year/week/scope, sorts locally, and restores cached results from history', async () => {
    const { router, fetcher } = setup()
    const pendingSummary = deferred<Response>()
    let summaryInput = ''
    fetcher.mockImplementation(async (input) => {
      if (String(input).includes('/summary')) {
        summaryInput = String(input)
        return pendingSummary.promise
      }
      return fixtureApiResponse(String(input))
    })
    const form = filterForm()
    fireEvent.change(form.getByLabelText('Év'), { target: { value: '2026' } })
    fireEvent.change(form.getByLabelText('Hét'), { target: { value: '40' } })
    fireEvent.change(form.getByLabelText('Kezdő dátum'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(form.getByLabelText('Záró dátum'), {
      target: { value: '2026-10-31' },
    })
    fireEvent.change(form.getByLabelText('Statisztikai számsor'), {
      target: { value: 'combined' },
    })
    fireEvent.change(form.getByLabelText('Gyakoriság rendezése'), {
      target: { value: 'least' },
    })
    expect(fetcher).not.toHaveBeenCalled()
    fireEvent.click(form.getByRole('button', { name: 'Szűrés' }))
    const loadingSubmit = await screen.findByRole('button', {
      name: 'Szűrés folyamatban…',
    })
    expect(loadingSubmit).toBeDisabled()
    await waitFor(() => expect(summaryInput).toContain('/summary'))
    await act(async () =>
      pendingSummary.resolve(await fixtureApiResponse(summaryInput)),
    )
    await waitFor(() =>
      expect(
        filterForm().getByRole('button', { name: 'Szűrés' }),
      ).toBeEnabled(),
    )
    expect(router.state.location.search).toBe(
      '?year=2026&week=40&from_date=2026-10-01&to_date=2026-10-31&set=combined&sort=least',
    )
    const calls = fetcher.mock.calls.map(
      ([input]) => new URL(String(input), 'http://fixture.test'),
    )
    expect(
      calls.filter((url) => url.pathname.includes('/statistics/')),
    ).toHaveLength(5)
    for (const url of calls.filter((url) =>
      url.pathname.includes('/statistics/'),
    )) {
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        year: '2026',
        week: '40',
        from_date: '2026-10-01',
        to_date: '2026-10-31',
        set: 'combined',
      })
      expect(url.searchParams.get('sort')).not.toBe('least')
    }
    expect(
      calls
        .find((url) => url.pathname.endsWith('/drawings'))
        ?.searchParams.get('per_page'),
    ).toBe('5')
    expect(within(frequencyTable()).getAllByRole('row')[1]).toHaveTextContent(
      '2',
    )
    const count = fetcher.mock.calls.length
    fireEvent.click(filterForm().getByRole('button', { name: 'Szűrés' }))
    expect(fetcher).toHaveBeenCalledTimes(count)
    fireEvent.click(filterForm().getByRole('button', { name: 'Alaphelyzet' }))
    expect(router.state.location.search).toBe('')
    expect(filterForm().getByLabelText('Év')).toHaveValue(null)
    expect(filterForm().getByLabelText('Statisztikai számsor')).toHaveValue(
      'machine',
    )
    await act(() => router.navigate(-1))
    await waitFor(() =>
      expect(
        filterForm().getByRole('button', { name: 'Szűrés' }),
      ).toBeEnabled(),
    )
    expect(filterForm().getByLabelText('Kezdő dátum')).toHaveValue('2026-10-01')
    expect(fetcher).toHaveBeenCalledTimes(count)
    await act(() => router.navigate(1))
    expect(filterForm().getByLabelText('Gyakoriság rendezése')).toHaveValue(
      'number',
    )
  })

  it.each(['five', 'six', 'scandinavian'] as const)(
    'normalizes an invalid direct %s URL before requesting and preserves valid filters',
    async (game) => {
      const { fetcher } = setup(
        game,
        '?year=2026&week=54&from_date=2026-02-30&to_date=2026-12-31&set=bonus&sort=evil&number=999&page=-1&secret=hidden',
      )
      await waitFor(() =>
        expect(
          filterForm().getByRole('button', { name: 'Szűrés' }),
        ).toBeEnabled(),
      )
      expect(filterForm().getByLabelText('Év')).toHaveValue(2026)
      expect(filterForm().getByLabelText('Hét')).toHaveValue(null)
      expect(filterForm().getByLabelText('Kezdő dátum')).toHaveValue('')
      expect(filterForm().getByLabelText('Gyakoriság rendezése')).toHaveValue(
        'number',
      )
      expect(fetcher.mock.calls.length).toBeGreaterThan(0)
      for (const [input] of fetcher.mock.calls) {
        const url = new URL(String(input), 'http://fixture.test')
        for (const key of ['week', 'from_date', 'secret', 'page'])
          expect(url.searchParams.has(key)).toBe(false)
        expect(url.searchParams.get('number')).not.toBe('999')
        if (url.pathname.includes('/statistics/'))
          expect(url.searchParams.get('set')).toBe(
            game === 'scandinavian' ? 'machine' : 'main',
          )
      }
    },
  )

  it('ignores a late canceled filter response after a newer filter has succeeded', async () => {
    const { router, fetcher } = setup('five')
    const old = deferred<Response>()
    let oldSignal: AbortSignal | null | undefined
    fetcher.mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://fixture.test')
      if (
        url.pathname.endsWith('/summary') &&
        url.searchParams.get('year') === '2024'
      ) {
        oldSignal = init?.signal
        return old.promise
      }
      return fixtureApiResponse(String(input))
    })
    await act(() => router.navigate('/game?year=2024'))
    await waitFor(() => expect(oldSignal).toBeDefined())
    await act(() => router.navigate('/game?year=2025'))
    await waitFor(() =>
      expect(
        filterForm().getByRole('button', { name: 'Szűrés' }),
      ).toBeEnabled(),
    )
    expect(oldSignal?.aborted).toBe(true)
    await act(async () =>
      old.resolve(Response.json({ private: 'late invalid response' })),
    )
    expect(filterForm().getByLabelText('Év')).toHaveValue(2025)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(frequencyTable()).toBeInTheDocument()
  })

  it.each([
    [400, 'Ellenőrizze a megadott szűrőket'],
    [422, 'Ellenőrizze a megadott szűrőket'],
    [401, 'A kéréshez nincs megfelelő hozzáférés'],
    [403, 'A kért tartalomhoz nincs hozzáférése'],
    [404, 'A kért sorsolás vagy adat nem található'],
    [500, 'Az adatok átmenetileg nem érhetők el'],
    [503, 'Az adatok átmenetileg nem érhetők el'],
  ])(
    'retains statistics and filters after HTTP %i and recovers through retry',
    async (status, message) => {
      const { fetcher } = setup('six')
      fetcher.mockImplementation(async (input) =>
        String(input).includes('/summary')
          ? Response.json(
              { message: 'private SQLite path and stack trace' },
              { status },
            )
          : fixtureApiResponse(String(input)),
      )
      fireEvent.change(filterForm().getByLabelText('Év'), {
        target: { value: '2022' },
      })
      fireEvent.click(filterForm().getByRole('button', { name: 'Szűrés' }))
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(message)
      expect(alert).not.toHaveTextContent('private')
      expect(filterForm().getByLabelText('Év')).toHaveValue(2022)
      expect(filterForm().getByRole('button', { name: 'Szűrés' })).toBeEnabled()
      expect(frequencyTable()).toBeInTheDocument()
      fetcher.mockImplementation(async (input) =>
        fixtureApiResponse(String(input)),
      )
      fireEvent.click(
        within(alert).getByRole('button', { name: 'Újrapróbálkozás' }),
      )
      await waitFor(() =>
        expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
      )
      expect(filterForm().getByLabelText('Év')).toHaveValue(2022)
    },
  )

  it('cannot bypass a 429 cooldown with retry and recovers when Retry-After expires', async () => {
    const { fetcher } = setup('five')
    fetcher.mockImplementation(async (input) =>
      String(input).includes('/summary')
        ? Response.json({}, { status: 429, headers: { 'Retry-After': '30' } })
        : fixtureApiResponse(String(input)),
    )
    fireEvent.change(filterForm().getByLabelText('Év'), {
      target: { value: '2021' },
    })
    fireEvent.click(filterForm().getByRole('button', { name: 'Szűrés' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Túl sok kérés')
    const count = fetcher.mock.calls.length
    fireEvent.click(
      within(alert).getByRole('button', { name: 'Újrapróbálkozás' }),
    )
    await screen.findByRole('alert')
    expect(fetcher).toHaveBeenCalledTimes(count)
    vi.setSystemTime(Date.now() + 30_000)
    fetcher.mockImplementation(async (input) =>
      fixtureApiResponse(String(input)),
    )
    fireEvent.click(
      within(screen.getByRole('alert')).getByRole('button', {
        name: 'Újrapróbálkozás',
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    expect(fetcher.mock.calls.length).toBeGreaterThan(count)
  })

  it('keeps multiple number selections, badge colors and URL state through theme changes and history', async () => {
    const { router, fetcher } = setup('six', '?number=1&number=12')
    await screen.findByRole('table', {
      name: '12. szám éves előfordulásai',
    })
    const chips = screen.getByRole('list', { name: 'Kiválasztott számok' })
    expect(within(chips).getAllByRole('listitem')[1]).toHaveStyle(
      '--series-color: #2563eb',
    )
    const count = fetcher.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Sötét' }))
    expect(within(chips).getAllByRole('listitem')[1]).toHaveStyle(
      '--series-color: #60a5fa',
    )
    expect(router.state.location.search).toBe('?number=1&number=12')
    fireEvent.click(
      within(chips).getByRole('button', { name: '12. szám eltávolítása' }),
    )
    expect(router.state.location.search).toBe('?number=1')
    await act(() => router.navigate(-1))
    await screen.findByRole('table', {
      name: '12. szám éves előfordulásai',
    })
    expect(within(chips).getAllByRole('listitem')).toHaveLength(2)
    expect(fetcher).toHaveBeenCalledTimes(count)
    fireEvent.click(screen.getByLabelText('Éves gyakoriságban vizsgált számok'))
    const group = screen.getByRole('group', { name: 'Vizsgált számok' })
    expect(within(group).getAllByRole('checkbox')).toHaveLength(45)
    const last = within(group).getByRole('checkbox', { name: '45. szám' })
    last.focus()
    fireEvent.keyDown(last, { key: 'Escape' })
    expect(
      screen.getByLabelText('Éves gyakoriságban vizsgált számok'),
    ).toHaveFocus()
  })

  it('keeps yearly table sorting independent for each selected number', async () => {
    setup('six', '?number=1&number=12')
    const firstTable = await screen.findByRole('table', {
      name: '1. szám éves előfordulásai',
    })
    const secondTable = await screen.findByRole('table', {
      name: '12. szám éves előfordulásai',
    })
    fireEvent.click(screen.getByText('Részletes éves adatok megjelenítése'))

    const firstSort = within(firstTable).getByRole('button', {
      name: 'Előfordulás, rendezés növekvő sorrendbe',
    })
    const secondSort = within(secondTable).getByRole('button', {
      name: 'Előfordulás, rendezés növekvő sorrendbe',
    })
    fireEvent.click(firstSort)

    expect(firstSort.closest('th')).toHaveAttribute('aria-sort', 'ascending')
    expect(secondSort.closest('th')).not.toHaveAttribute('aria-sort')
  })
})
