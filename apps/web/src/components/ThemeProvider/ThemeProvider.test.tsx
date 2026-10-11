import { act, render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'

function ThemeState() {
  const { mode, resolvedTheme, setMode } = useTheme()
  return (
    <>
      <output>{`${mode}:${resolvedTheme}`}</output>
      <button onClick={() => setMode('light')}>Set light</button>
      <button onClick={() => setMode('dark')}>Set dark</button>
    </>
  )
}

function renderTheme() {
  return render(
    <ThemeProvider>
      <ThemeState />
    </ThemeProvider>,
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('ThemeProvider', () => {
  it('defaults to Light regardless of operating system preference', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia')
    renderTheme()
    expect(screen.getByText('light:light')).toBeInTheDocument()
    expect(matchMedia).not.toHaveBeenCalled()
  })

  it('restores a saved Dark preference and persists later selections', async () => {
    localStorage.setItem('lottery-stats-theme', 'dark')
    renderTheme()
    expect(await screen.findByText('dark:dark')).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')

    await act(async () => screen.getByText('Set light').click())
    expect(screen.getByText('light:light')).toBeInTheDocument()
    expect(localStorage.getItem('lottery-stats-theme')).toBe('light')
  })

  it('normalizes a previously saved System preference to Light', async () => {
    localStorage.setItem('lottery-stats-theme', 'system')
    renderTheme()
    expect(await screen.findByText('light:light')).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('lottery-stats-theme')).toBe('light')
  })

  it('hydrates the prerendered Light markup without warnings', async () => {
    localStorage.setItem('lottery-stats-theme', 'dark')
    const element = (
      <ThemeProvider>
        <ThemeState />
      </ThemeProvider>
    )
    const container = document.createElement('div')
    container.innerHTML = renderToString(element)
    document.body.append(container)
    expect(container).toHaveTextContent('light:light')

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      await act(async () => {
        root = hydrateRoot(container, element)
      })
      expect(container).toHaveTextContent('light:light')
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      if (root) await act(async () => root?.unmount())
      container.remove()
    }
  })

  it('keeps the in-memory theme usable when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderTheme()
    await act(async () => screen.getByText('Set dark').click())
    expect(screen.getByText('dark:dark')).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
