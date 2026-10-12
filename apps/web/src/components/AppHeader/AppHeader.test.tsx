import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppHeader } from './AppHeader'
import { ThemeProvider } from '../ThemeProvider'

describe('sticky header state', () => {
  it('keeps the active route through hover and slides the active pill on route changes', () => {
    render(
      <MemoryRouter initialEntries={['/otoslotto']}>
        <ThemeProvider>
          <AppHeader />
        </ThemeProvider>
      </MemoryRouter>,
    )
    const five = screen.getByRole('link', { name: 'Ötöslottó' })
    const six = screen.getByRole('link', { name: 'Hatoslottó' })
    expect(five).toHaveAttribute('aria-current', 'page')
    fireEvent.mouseEnter(six)
    expect(five).toHaveAttribute('aria-current', 'page')
    expect(six).not.toHaveAttribute('aria-current')
    fireEvent.click(six)
    expect(six).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByRole('navigation').querySelector('[aria-hidden="true"]'),
    ).toHaveStyle({ transform: 'translateX(100%)' })
  })
  it('keeps the home route unselected and exposes an Escape-dismissible mobile disclosure', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <AppHeader />
        </ThemeProvider>
      </MemoryRouter>,
    )
    const navigation = screen.getByRole('navigation')
    const toggle = screen.getByRole('button', { name: 'Menü megnyitása' })
    expect(
      navigation.querySelector('[aria-current="page"]'),
    ).not.toBeInTheDocument()
    expect(navigation).toHaveAttribute('data-open', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'primary-navigation')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAccessibleName('Menü bezárása')
    expect(navigation).toHaveAttribute('data-open', 'true')
    fireEvent.keyDown(navigation, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAccessibleName('Menü megnyitása')
  })
  it('closes after choosing a game and closes when resized to desktop', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <AppHeader />
        </ThemeProvider>
      </MemoryRouter>,
    )
    const toggle = screen.getByRole('button', { name: 'Menü megnyitása' })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'Sötét' }))
    expect(screen.getByRole('button', { name: 'Sötét' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('link', { name: 'Ötöslottó' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Ötöslottó' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    fireEvent.click(toggle)
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    })
    act(() => window.dispatchEvent(new Event('resize')))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
  it('starts clear at the top and applies its scrolled state after scrolling', () => {
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
    })
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppHeader />
        </ThemeProvider>
      </MemoryRouter>,
    )
    const header = screen.getByRole('banner')
    expect(header).not.toHaveClass(/scrolled/)
    expect(screen.getByRole('navigation')).toBeInTheDocument()

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 24 })
    act(() => window.dispatchEvent(new Event('scroll')))
    expect(header).toHaveClass(/scrolled/)

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    act(() => window.dispatchEvent(new Event('scroll')))
    expect(header).not.toHaveClass(/scrolled/)
  })
})
