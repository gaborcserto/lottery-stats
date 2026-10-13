import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Root from '../../root'
import Five from '../../routes/five'
import { shouldRevalidate } from '../../routes/six'
import { deferred, fixturePageData } from '../../test/fixtures'
import * as pageData from '../../api/page-data'
import type { GamePageData } from '../../api/page-data'
import { api, ApiError } from '../../api/client'
import { GameRoute } from '.'

afterEach(() => vi.restoreAllMocks())

describe('game route loading', () => {
  it('reuses the default yearly series, deselects numbers and restores selections from history', async () => {
    const data = {
      ...fixturePageData('five'),
      capturedAt: new Date().toISOString(),
    }
    if (!data.yearly) throw new Error('Missing yearly fixture')
    const base = data.yearly
    const yearly = vi
      .spyOn(api, 'yearly')
      .mockImplementation(async (_game, query) => ({
        ...base,
        meta: { ...base.meta, selected_number: query?.number ?? 1 },
      }))
    const router = createMemoryRouter(
      [{ path: '/otoslotto', element: <GameRoute game="five" data={data} /> }],
      { initialEntries: ['/otoslotto?sort=number'] },
    )
    render(<RouterProvider router={router} />)
    fireEvent.click(screen.getByLabelText('Éves gyakoriságban vizsgált számok'))
    fireEvent.click(screen.getByRole('checkbox', { name: '12. szám' }))
    await waitFor(() => expect(yearly).toHaveBeenCalledTimes(1))
    expect(yearly).toHaveBeenCalledWith(
      'five',
      { set: 'main', number: 12 },
      expect.any(AbortSignal),
    )
    await screen.findByRole('table', {
      name: '12. szám éves előfordulásai',
    })
    fireEvent.click(
      screen.getByRole('button', { name: '12. szám eltávolítása' }),
    )
    expect(screen.getByRole('checkbox', { name: '1. szám' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '12. szám' })).not.toBeChecked()
    await act(() => router.navigate(-1))
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: '12. szám' })).toBeChecked(),
    )
    await screen.findByRole('table', {
      name: '12. szám éves előfordulásai',
    })
    expect(yearly).toHaveBeenCalledTimes(1)
    router.dispose()
  })

  it('hydrates a filtered URL from default HTML and keeps the snapshot on filter failure', async () => {
    const data = fixturePageData('scandinavian')
    const summary = vi
      .spyOn(api, 'summary')
      .mockRejectedValue(new ApiError('network'))
    vi.spyOn(api, 'latest').mockRejectedValue(new ApiError('network'))
    vi.spyOn(api, 'frequencies').mockResolvedValue(data.frequencies)
    vi.spyOn(api, 'parity').mockResolvedValue(data.parity)
    vi.spyOn(api, 'drawingHistory').mockRejectedValue(new ApiError('network'))
    vi.spyOn(api, 'pairs').mockRejectedValue(new ApiError('network'))
    vi.spyOn(api, 'yearly').mockRejectedValue(new ApiError('network'))
    const loader = vi.fn(async () => data)
    const router = createMemoryRouter(
      [
        {
          id: 'game',
          path: '/skandinav-lotto',
          loader,
          element: <GameRoute game="scandinavian" data={data} />,
        },
      ],
      {
        initialEntries: ['/skandinav-lotto?year=2023&week=12&set=combined'],
        hydrationData: { loaderData: { game: data } },
      },
    )
    const container = document.createElement('div')
    document.body.append(container)
    container.innerHTML = renderToString(<RouterProvider router={router} />)
    expect(container.querySelector('input[name="year"]')).toHaveAttribute(
      'value',
      '',
    )
    const originalHeading = container.querySelector('h1')
    const recovery = vi.fn()
    const root = hydrateRoot(container, <RouterProvider router={router} />, {
      onRecoverableError: recovery,
    })
    try {
      await waitFor(
        () =>
          expect(screen.getByText(/A szűrés nem sikerült/)).toBeInTheDocument(),
        { timeout: 5000 },
      )
      expect(screen.getByLabelText('Év')).toHaveValue(2023)
      expect(screen.getByLabelText('Statisztikai számsor')).toHaveValue(
        'combined',
      )
      expect(summary).toHaveBeenCalledWith(
        'scandinavian',
        { year: 2023, week: 12, set: 'combined' },
        expect.any(AbortSignal),
      )
      expect(container.querySelector('h1')).toBe(originalHeading)
      expect(
        screen.getByRole('table', { name: /Skandináv lottó: előfordulások/ }),
      ).toBeInTheDocument()
      expect(loader).not.toHaveBeenCalled()
      expect(recovery).not.toHaveBeenCalled()
    } finally {
      await act(async () => root.unmount())
      router.dispose()
      container.remove()
    }
  })

  it('changes visual sorting without a request and fetches only selected yearly data', async () => {
    const data = {
      ...fixturePageData('six'),
      capturedAt: new Date().toISOString(),
    }
    if (!data.yearly) throw new Error('Missing yearly fixture')
    const yearly = vi.spyOn(api, 'yearly').mockImplementation((_game, query) =>
      Promise.resolve({
        ...data.yearly!,
        meta: { ...data.yearly!.meta, selected_number: query?.number ?? 1 },
      }),
    )
    const summary = vi.spyOn(api, 'summary')
    const frequencies = vi.spyOn(api, 'frequencies')
    const loader = vi.fn(async () => data)
    const router = createMemoryRouter(
      [
        {
          path: '/hatoslotto',
          loader,
          shouldRevalidate,
          hydrateFallbackElement: <p>Betöltés…</p>,
          element: <GameRoute game="six" data={data} />,
        },
      ],
      { initialEntries: ['/hatoslotto?sort=most'] },
    )
    render(<RouterProvider router={router} />)
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Hatoslottó' },
      { timeout: 5000 },
    )
    expect(summary).not.toHaveBeenCalled()
    expect(frequencies).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Éves gyakoriságban vizsgált számok'))
    fireEvent.click(screen.getByRole('checkbox', { name: '42. szám' }))
    await screen.findByRole('table', {
      name: '42. szám éves előfordulásai',
    })
    fireEvent.click(screen.getByRole('checkbox', { name: '45. szám' }))
    await screen.findByRole('table', {
      name: '45. szám éves előfordulásai',
    })
    fireEvent.click(screen.getByRole('checkbox', { name: '1. szám' }))
    await waitFor(() => expect(yearly).toHaveBeenCalledTimes(2))
    expect(yearly).toHaveBeenNthCalledWith(
      1,
      'six',
      { set: 'main', number: 42 },
      expect.any(AbortSignal),
    )
    expect(yearly).toHaveBeenNthCalledWith(
      2,
      'six',
      { set: 'main', number: 45 },
      expect.any(AbortSignal),
    )
    expect(router.state.location.search).toBe('?sort=most&number=42&number=45')
    expect(summary).not.toHaveBeenCalled()
    expect(frequencies).not.toHaveBeenCalled()
    expect(loader).toHaveBeenCalledTimes(1)
    await router.navigate(-3)
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: '1. szám' })).toBeChecked(),
    )
    await router.navigate(3)
    await waitFor(() =>
      expect(router.state.location.search).toBe(
        '?sort=most&number=42&number=45',
      ),
    )
    router.dispose()
  })
  it.each([
    ['success', undefined],
    ['failure', 'Az adatok átmenetileg nem érhetők el.'],
  ])(
    'keeps the stale sorted page visible through a delayed refresh %s',
    async (_outcome, refreshError) => {
      const data = fixturePageData('five')
      const refresh = deferred<GamePageData>()
      const background = vi
        .spyOn(pageData, 'loadGameWithFallback')
        .mockReturnValue(refresh.promise)
      const loader = vi.fn(async () => data)
      const router = createMemoryRouter(
        [
          {
            path: '/',
            Component: Root,
            children: [
              { id: 'game', path: 'otoslotto', Component: Five, loader },
            ],
          },
        ],
        {
          initialEntries: ['/otoslotto?sort=most&number=1'],
          hydrationData: { loaderData: { game: data } },
        },
      )
      const container = document.createElement('div')
      document.body.append(container)
      container.innerHTML = renderToString(<RouterProvider router={router} />)
      const heading = container.querySelector('h1')
      const recovery = vi.fn()
      const root = hydrateRoot(container, <RouterProvider router={router} />, {
        onRecoverableError: recovery,
      })
      try {
        await waitFor(() => expect(background).toHaveBeenCalledTimes(1))
        expect(router.state.revalidation).toBe('idle')
        expect(screen.getByText(/Az adatok friss/)).toBeInTheDocument()
        expect(container.querySelector('h1')).toBe(heading)
        expect(
          screen.getByRole('heading', { name: 'Számgyakoriság' }),
        ).toBeInTheDocument()
        expect(screen.queryByText(/Az oldal betöltése/)).not.toBeInTheDocument()
        await act(async () =>
          refresh.resolve({
            ...data,
            ...(refreshError ? { refreshError } : {}),
          }),
        )
        expect(container.querySelector('h1')).toBe(heading)
        if (refreshError)
          expect(
            screen.getByText(/A frissítés nem sikerült/),
          ).toHaveTextContent(refreshError)
        else
          expect(
            screen.queryByText(/Az adatok frissítése/),
          ).not.toBeInTheDocument()
        expect(recovery).not.toHaveBeenCalled()
        expect(loader).not.toHaveBeenCalled()
      } finally {
        await act(async () => root.unmount())
        router.dispose()
        container.remove()
      }
    },
  )

  it('keeps the current page during pending navigation without inserting a loading message', async () => {
    const next = deferred<GamePageData>()
    const router = createMemoryRouter([
      {
        path: '/',
        Component: Root,
        children: [
          { index: true, element: <h1>Meglévő tartalom</h1> },
          { path: 'otoslotto', Component: Five, loader: () => next.promise },
        ],
      },
    ])
    render(<RouterProvider router={router} />)
    fireEvent.click(screen.getByRole('link', { name: 'Ötöslottó' }))
    expect(
      screen.getByRole('heading', { name: 'Meglévő tartalom' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await act(async () => next.resolve(fixturePageData('five')))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ötöslottó' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false')
    router.dispose()
  })
})
