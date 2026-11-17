import { act, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deferred, fixtureResponses } from '../../test/fixtures'
import type { HomePageData } from '../../api/page-data'
import { loadHome } from '../../api/page-data'
import { HomePage } from './HomePage'

vi.mock('../../api/page-data', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/page-data')>()
  return { ...original, loadHome: vi.fn(() => new Promise(() => {})) }
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.mocked(loadHome).mockImplementation(() => new Promise(() => {}))
})

describe('HomePage', () => {
  it('ignores a late successful refresh after newer data starts a refresh', async () => {
    vi.useFakeTimers()
    const stale = deferred<HomePageData>()
    const current = deferred<HomePageData>()
    vi.mocked(loadHome)
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(current.promise)
    const drawing = fixtureResponses('five').drawing.data
    const data: HomePageData = {
      latest: [{ game: 'five', drawing }],
      capturedAt: '2026-10-10T00:00:00.000Z',
    }
    const view = render(
      <MemoryRouter>
        <HomePage data={data} />
      </MemoryRouter>,
    )

    await act(() => vi.advanceTimersByTimeAsync(0))
    const oldSignal = vi.mocked(loadHome).mock.calls[0][1]
    view.rerender(
      <MemoryRouter>
        <HomePage data={{ ...data, capturedAt: '2026-10-11T00:00:00.000Z' }} />
      </MemoryRouter>,
    )
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(oldSignal?.aborted).toBe(true)

    await act(async () => {
      current.resolve({
        ...data,
        latest: [
          { game: 'five', drawing: { ...drawing, drawn_on: '2026-10-11' } },
        ],
      })
    })
    expect(view.container.querySelector('time')).toHaveAttribute(
      'dateTime',
      '2026-10-11',
    )

    await act(async () => {
      stale.resolve({
        ...data,
        latest: [
          { game: 'five', drawing: { ...drawing, drawn_on: '2026-10-09' } },
        ],
      })
    })
    expect(view.container.querySelector('time')).toHaveAttribute(
      'dateTime',
      '2026-10-11',
    )
  })

  it('renders all three data-backed lottery cards', () => {
    render(
      <MemoryRouter>
        <HomePage
          data={{
            latest: (['five', 'six', 'scandinavian'] as const).map((game) => ({
              game,
              drawing: fixtureResponses(game).drawing.data,
            })),
            capturedAt: '2026-10-10T00:00:00.000Z',
          }}
        />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: 'A számok mögött.' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Ötöslottó' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Hatoslottó' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Skandináv lottó' }),
    ).toBeInTheDocument()
  })

  it('keeps prerendered results visible and announces a failed refresh', async () => {
    vi.mocked(loadHome).mockRejectedValueOnce(
      new Error('private backend detail'),
    )
    render(
      <MemoryRouter>
        <HomePage
          data={{
            latest: [
              {
                game: 'five',
                drawing: fixtureResponses('five').drawing.data,
              },
              { game: 'six', drawing: fixtureResponses('six').drawing.data },
              {
                game: 'scandinavian',
                drawing: fixtureResponses('scandinavian').drawing.data,
              },
            ],
            capturedAt: '2026-10-10T00:00:00.000Z',
          }}
        />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'A frissítés nem sikerült.',
    )
    expect(screen.getByLabelText('Ötöslottó: Főszámok')).toBeInTheDocument()
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument()
  })

  it('starts one refresh after Strict Mode replays the effect', async () => {
    vi.useFakeTimers()
    const data = {
      latest: (['five', 'six', 'scandinavian'] as const).map((game) => ({
        game,
        drawing: fixtureResponses(game).drawing.data,
      })),
      capturedAt: '2026-10-10T00:00:00.000Z',
    }
    const view = render(
      <StrictMode>
        <MemoryRouter>
          <HomePage data={data} />
        </MemoryRouter>
      </StrictMode>,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(loadHome).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('article')).toHaveLength(3)
    view.unmount()
  })

  it('does not announce a canceled refresh as a failure', async () => {
    vi.useFakeTimers()
    vi.mocked(loadHome).mockImplementation(
      (_client, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const view = render(
      <MemoryRouter>
        <HomePage
          data={{
            latest: [
              {
                game: 'five',
                drawing: fixtureResponses('five').drawing.data,
              },
              { game: 'six', drawing: fixtureResponses('six').drawing.data },
              {
                game: 'scandinavian',
                drawing: fixtureResponses('scandinavian').drawing.data,
              },
            ],
            capturedAt: '2026-10-10T00:00:00.000Z',
          }}
        />
      </MemoryRouter>,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    view.unmount()
    await act(async () => {})
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
