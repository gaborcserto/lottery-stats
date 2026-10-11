import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from '../ThemeProvider'
import { ThemeSwitcher } from './ThemeSwitcher'

describe('ThemeSwitcher', () => {
  it('exposes a keyboard-operable group and marks the selected mode', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    )
    expect(
      screen.getByRole('group', { name: 'Téma választása' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
    const light = screen.getByRole('button', { name: 'Világos' })
    const dark = screen.getByRole('button', { name: 'Sötét' })
    expect(light).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(dark, { key: 'Enter' })
    fireEvent.click(dark)
    expect(dark).toHaveAttribute('aria-pressed', 'true')
    expect(light).toHaveAttribute('aria-pressed', 'false')
  })
})
