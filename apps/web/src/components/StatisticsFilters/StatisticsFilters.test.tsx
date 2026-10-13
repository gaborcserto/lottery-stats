import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  createMemoryRouter,
  RouterProvider,
  useSearchParams,
} from 'react-router'
import { describe, expect, it } from 'vitest'
import { StatisticsFilters } from '.'
import { parseFilters } from '../../api/filters'

function Filters({ pending = false }: { pending?: boolean }) {
  const [params] = useSearchParams()
  return (
    <StatisticsFilters
      game="scandinavian"
      filters={parseFilters(params, 'scandinavian')}
      pending={pending}
    />
  )
}
describe('shareable statistics controls', () => {
  it('shows pending feedback and prevents another submission while filtering', () => {
    const router = createMemoryRouter(
      [{ path: '/', Component: () => <Filters pending /> }],
      { initialEntries: ['/?year=2020'] },
    )
    render(<RouterProvider router={router} />)
    expect(
      screen.getByRole('button', { name: 'Szűrés folyamatban…' }),
    ).toBeDisabled()
    expect(
      screen.getByLabelText('Statisztikai szűrők').querySelector('form'),
    ).toHaveAttribute('aria-busy', 'true')
    router.dispose()
  })

  it('submits supported filters and follows browser back and forward', async () => {
    const router = createMemoryRouter([{ path: '/', Component: Filters }], {
      initialEntries: ['/?year=2020&set=manual&number=35&page=2'],
    })
    render(<RouterProvider router={router} />)
    expect(screen.getByLabelText('Év')).toHaveValue(2020)
    expect(screen.getByLabelText('Statisztikai számsor')).toHaveValue('manual')
    fireEvent.change(screen.getByLabelText('Év'), { target: { value: '2021' } })
    fireEvent.change(screen.getByLabelText('Statisztikai számsor'), {
      target: { value: 'combined' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Szűrés' }))
    expect(router.state.location.search).toContain('year=2021')
    expect(router.state.location.search).toContain('set=combined')
    expect(router.state.location.search).toContain('number=35')
    expect(router.state.location.search).not.toContain('page=')
    await act(async () => {
      await router.navigate(-1)
    })
    expect(screen.getByLabelText('Év')).toHaveValue(2020)
    expect(screen.getByLabelText('Statisztikai számsor')).toHaveValue('manual')
    await act(async () => {
      await router.navigate(1)
    })
    expect(screen.getByLabelText('Év')).toHaveValue(2021)
    expect(screen.getByLabelText('Statisztikai számsor')).toHaveValue(
      'combined',
    )
    router.dispose()
  })

  it('restores keyboard focus after filter submission and reset', () => {
    const router = createMemoryRouter([{ path: '/', Component: Filters }], {
      initialEntries: ['/?year=2020'],
    })
    render(<RouterProvider router={router} />)
    const year = document.querySelector<HTMLInputElement>('[name="year"]')
    if (!year) throw new Error('Missing year filter')
    fireEvent.change(year, { target: { value: '2021' } })
    year.focus()
    const form = year.closest('form')
    if (!form) throw new Error('Missing filter form')
    fireEvent.submit(form)
    expect(document.querySelector('[name="year"]')).toHaveFocus()
    const reset = screen.getByRole('button', { name: 'Alaphelyzet' })
    reset.focus()
    fireEvent.click(reset)
    expect(screen.getByRole('button', { name: 'Alaphelyzet' })).toHaveFocus()
    router.dispose()
  })

  it('does not move focus when the URL changes outside filter controls', async () => {
    const router = createMemoryRouter([{ path: '/', Component: Filters }], {
      initialEntries: ['/?year=2020'],
    })
    render(<RouterProvider router={router} />)
    const year = document.querySelector<HTMLInputElement>('[name="year"]')
    if (!year) throw new Error('Missing year filter')
    year.focus()
    await act(async () => router.navigate('/?year=2021'))
    expect(document.querySelector('[name="year"]')).not.toHaveFocus()
    router.dispose()
  })

  it('rejects reversed dates and resets all filters', () => {
    const router = createMemoryRouter([{ path: '/', Component: Filters }], {
      initialEntries: ['/?year=2020'],
    })
    render(<RouterProvider router={router} />)
    fireEvent.change(screen.getByLabelText('Kezdő dátum'), {
      target: { value: '2024-03-01' },
    })
    fireEvent.change(screen.getByLabelText('Záró dátum'), {
      target: { value: '2024-02-29' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Szűrés' }))
    expect(screen.getByLabelText('Záró dátum')).toBeInvalid()
    expect(router.state.location.search).toBe('?year=2020')
    fireEvent.click(screen.getByRole('button', { name: 'Alaphelyzet' }))
    expect(router.state.location.search).toBe('')
    expect(screen.getByLabelText('Év')).toHaveValue(null)
    router.dispose()
  })

  it('clears draft fields and validity when URL defaults are already active', () => {
    const router = createMemoryRouter([{ path: '/', Component: Filters }], {
      initialEntries: ['/?sort=number&set=machine'],
    })
    render(<RouterProvider router={router} />)
    fireEvent.change(screen.getByLabelText('Év'), { target: { value: '2024' } })
    fireEvent.change(screen.getByLabelText('Hét'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Kezdő dátum'), {
      target: { value: '2024-03-01' },
    })
    fireEvent.change(screen.getByLabelText('Záró dátum'), {
      target: { value: '2024-02-29' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Szűrés' }))
    expect(screen.getByLabelText('Záró dátum')).toBeInvalid()
    fireEvent.click(screen.getByRole('button', { name: 'Alaphelyzet' }))
    expect(router.state.location.search).toBe('')
    expect(screen.getByLabelText('Év')).toHaveValue(null)
    expect(screen.getByLabelText('Hét')).toHaveValue(null)
    expect(screen.getByLabelText('Kezdő dátum')).toHaveValue('')
    expect(screen.getByLabelText('Záró dátum')).toHaveValue('')
    expect(screen.getByLabelText('Záró dátum')).toBeValid()
    expect(screen.getByLabelText('Gyakoriság rendezése')).toHaveValue('number')
    router.dispose()
  })
})
