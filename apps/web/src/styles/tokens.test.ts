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
