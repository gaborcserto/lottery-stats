import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/client'
import { fixturePageData, fixtureResponses } from '../../test/fixtures'
import { GamePage } from '.'

afterEach(() => vi.restoreAllMocks())

describe('history URL navigation', () => {
  it('fetches only the requested page and restores cached pages through browser history', async () => {
    const data = fixturePageData('five')
    data.historyPage = { current: 1, last: 727, total: 3631 }
    const fixture = fixtureResponses('five')
    const drawings = vi
      .spyOn(api, 'drawings')
      .mockImplementation(async (_game, query) => ({
        ...fixture.history,
        meta: {
          ...fixture.history.meta,
          current_page: query?.page ?? 1,
          last_page: 727,
          per_page: 5,
          total: 3631,
        },
      }))
    vi.spyOn(api, 'drawing').mockResolvedValue(fixture.drawing)
    const router = createMemoryRouter(
      [{ path: '/otoslotto', element: <GamePage game="five" data={data} /> }],
      { initialEntries: ['/otoslotto?sort=least&number=1'] },
    )
    render(<RouterProvider router={router} />)
    fireEvent.click(screen.getByRole('button', { name: 'Utolsó oldal' }))
    expect(screen.getByText('A sorsolások betöltése…')).toBeInTheDocument()
    expect(
      screen.getByText('1, 12, 23, 34, 45', { exact: false }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '727. oldal' }),
      ).toHaveAttribute('aria-current', 'page'),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('navigation', {
          name: 'Sorsolási előzmények lapozása',
        }),
      ).toHaveAttribute('aria-busy', 'false'),
    )
    expect(drawings).toHaveBeenCalledWith(
      'five',
      { per_page: 5, page: 727 },
      expect.any(AbortSignal),
    )
    expect(router.state.location.search).toBe('?sort=least&number=1&page=727')
    fireEvent.click(screen.getByRole('button', { name: 'Első oldal' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '1. oldal' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    )
    expect(drawings).toHaveBeenCalledTimes(1)
    await act(() => router.navigate(-1))
    await waitFor(() =>
      expect(
        screen.getByRole('navigation', {
          name: 'Sorsolási előzmények lapozása',
        }),
      ).toHaveAttribute('aria-busy', 'false'),
    )
    expect(screen.getByRole('button', { name: '727. oldal' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(drawings).toHaveBeenCalledTimes(1)
    await act(() => router.navigate(1))
    expect(screen.getByRole('button', { name: '1. oldal' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    router.dispose()
  })
})
