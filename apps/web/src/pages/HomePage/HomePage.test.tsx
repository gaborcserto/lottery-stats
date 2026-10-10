import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { fixtureResponses } from '../../test/fixtures'
import { loadHome } from '../../api/page-data'
import { HomePage } from './HomePage'

vi.mock('../../api/page-data', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/page-data')>()
  return { ...original, loadHome: vi.fn(() => new Promise(() => {})) }
})

describe('HomePage', () => {
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
      screen.getByRole('heading', { name: 'Lottóeredmények, tisztán.' }),
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
})
