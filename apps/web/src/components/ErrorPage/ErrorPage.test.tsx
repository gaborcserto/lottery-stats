import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ErrorPage } from './ErrorPage'

function renderPage(status: number, onRetry?: () => void) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <ErrorPage status={status} onRetry={onRetry} />,
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('ErrorPage', () => {
  it('shows the missing page message and a working home link', () => {
    renderPage(404)
    expect(
      screen.getByRole('heading', { name: 'Az oldal nem tal\u00e1lhat\u00f3' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Vissza a f\u0151oldalra/ }),
    ).toHaveAttribute('href', '/')
  })

  it.each([
    [500, 'V\u00e1ratlan hiba t\u00f6rt\u00e9nt'],
    [503, 'A szolg\u00e1ltat\u00e1s \u00e1tmenetileg nem \u00e9rhet\u0151 el'],
    [403, 'A hozz\u00e1f\u00e9r\u00e9s megtagadva'],
  ])('presents status %i with a safe localized heading', (status, heading) => {
    renderPage(status)
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('runs its retry action when requested', () => {
    const retry = vi.fn()
    renderPage(503, retry)
    fireEvent.click(
      screen.getByRole('button', {
        name: /\u00dajrapr\u00f3b\u00e1lkoz\u00e1s/,
      }),
    )
    expect(retry).toHaveBeenCalledOnce()
  })
})
