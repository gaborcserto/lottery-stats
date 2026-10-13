import { resolve } from 'node:path'
import { compile } from 'sass'
import { describe, expect, it } from 'vitest'

describe('brand color theme tokens', () => {
  it('uses the same lime token in Light and Dark themes', () => {
    const css = compile(resolve(process.cwd(), 'src/index.scss')).css

    expect(css).toContain('--brand-lime: #74bf1e;')
    expect(css.match(/--brand-lime: #74bf1e;/gu)).toHaveLength(1)

    for (const selector of [':root {', ':root[data-theme=dark] {']) {
      const themeStart = css.indexOf(selector)
      expect(themeStart).toBeGreaterThanOrEqual(0)
      const themeEnd = css.indexOf('\n}', themeStart)
      const theme = css.slice(themeStart, themeEnd)
      expect(theme).toContain('--accent-lime: var(--brand-lime);')
      expect(theme).toContain('--hero-accent: var(--brand-lime);')
      expect(theme).toContain('--chart-primary: var(--brand-lime);')
      expect(theme).toContain('--ball-most-background: var(--brand-lime);')
      expect(theme).toContain('--ball-most-text: #fff;')
      expect(theme).toContain(
        '--ball-least-background: var(--ball-least-blue);',
      )
      expect(theme).toContain('--ball-least-text: #fff;')
    }

    const lightStart = css.indexOf(':root {')
    const lightEnd = css.indexOf('\n}', lightStart)
    const lightTheme = css.slice(lightStart, lightEnd)
    expect(lightTheme).toContain('--navigation-hover-text: #102330;')
    expect(lightTheme).toContain('--navigation-active-text: #102330;')
    expect(lightTheme).toContain('--navigation-active: var(--brand-lime);')
    expect(lightTheme).toContain('--action-background: var(--brand-lime);')
    expect(lightTheme).toContain('--action-text: #fff;')

    const darkStart = css.indexOf(':root[data-theme=dark] {')
    const darkEnd = css.indexOf('\n}', darkStart)
    const darkTheme = css.slice(darkStart, darkEnd)
    expect(darkTheme).toContain('--navigation-hover-text: var(--brand-lime);')
    expect(darkTheme).toContain('--navigation-active-text: var(--brand-lime);')
    expect(darkTheme).toContain('--navigation-border: transparent;')
  })
})

describe('navigation motion preference', () => {
  it('disables capsule transitions when reduced motion is requested', () => {
    const css = compile(
      resolve(process.cwd(), 'src/components/AppHeader/AppHeader.module.scss'),
    ).css
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('transition: none;')
  })
})

describe('selected number control colors', () => {
  it('uses the restored action tokens for checked number options', () => {
    const css = compile(
      resolve(
        process.cwd(),
        'src/components/NumberPicker/NumberPicker.module.scss',
      ),
    ).css

    expect(css).toContain('background: var(--action-background);')
    expect(css).toContain('color: var(--action-text);')
    expect(css).toContain('border-color: var(--action-background);')
  })
})

describe('responsive navigation and yearly table layouts', () => {
  it('uses a theme-opaque mobile menu and a theme-matched menu trigger', () => {
    const css = compile(
      resolve(process.cwd(), 'src/components/AppHeader/AppHeader.module.scss'),
    ).css

    expect(css).toContain('border: 1px solid var(--border);')
    expect(css).toContain('background: var(--surface);')
    expect(css).toContain('box-shadow: var(--glass-shadow);')
    expect(css).not.toContain('background: var(--navigation-background);')
    expect(css).toContain('width: auto;')
    expect(css).toContain('height: auto;')
    expect(css).toContain('border-radius: 2rem;')
    expect(css).toContain('background: var(--elevated);')
    expect(css).toContain('top: 0.2rem;')
    expect(css).toContain('left: 0.2rem;')
    expect(css).toContain('width: 2.75rem;')
    expect(css).toContain('height: 2.75rem;')
    expect(css).toContain('background: var(--surface);')
    expect(css).toContain('width: 1.25rem;')
    expect(css).toContain('color: var(--link);')
    expect(css).toContain('filter: none;')
    expect(css).toMatch(
      /\.menuToggle:hover:not\(:disabled\)\s*\{\s*filter: none;/u,
    )
    expect(css).toMatch(
      /\.menuToggle:active:not\(:disabled\)\s*\{\s*transform: none;/u,
    )
  })

  it('caps yearly table grids at four columns based on their container width', () => {
    const css = compile(
      resolve(
        process.cwd(),
        'src/components/YearlyTrends/YearlyTrends.module.scss',
      ),
    ).css

    expect(css).toContain('@container (min-width: 42rem)')
    expect(css).toContain('@container (min-width: 60rem)')
    expect(css).toContain('@container (min-width: 84rem)')
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));')
    expect(css).not.toContain('repeat(5,')
    expect(css).toContain('max-height: 22rem;')
  })
})
