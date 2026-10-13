import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppLayout } from '.'

describe('shared layout and navigation', () => {
  it('provides semantic landmarks, a skip link and Hungarian active navigation', () => {
    render(
      <MemoryRouter initialEntries={['/hatoslotto']}>
        <AppLayout>
          <h1>Hatoslottó</h1>
        </AppLayout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Lottery Stats – Kezdőlap' }),
    ).toHaveAttribute('href', '/')
    expect(
      screen.getAllByRole('img', { name: 'Lottery Stats' })[0],
    ).toHaveAttribute('src', '/images/logo.png')
    expect(
      within(screen.getByRole('contentinfo')).getByRole('link', {
        name: 'Lottery Stats – Kezdőlap (lábléc)',
      }),
    ).toHaveAttribute('href', '/')
    expect(
      screen.getByRole('navigation', { name: 'Fő navigáció' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hatoslottó' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('link', { name: 'Ugrás a tartalomra' }),
    ).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('navigates between game URLs and updates the active link', () => {
    render(
      <MemoryRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<h1>Kezdőlap</h1>} />
            <Route path="/otoslotto" element={<h1>Ötöslottó oldal</h1>} />
          </Routes>
        </AppLayout>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('link', { name: 'Ötöslottó' }))
    expect(
      screen.getByRole('heading', { name: 'Ötöslottó oldal' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ötöslottó' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    fireEvent.click(
      screen.getByRole('link', { name: 'Lottery Stats – Kezdőlap' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Kezdőlap' }),
    ).toBeInTheDocument()
  })

  it('retains content and accessible busy state without a global loading message', () => {
    render(
      <MemoryRouter>
        <AppLayout pending>
          <h1>Adatok</h1>
        </AppLayout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Adatok' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  })
})
