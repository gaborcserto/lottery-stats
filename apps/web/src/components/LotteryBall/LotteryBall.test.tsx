import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LotteryBall } from '.'
import { ThemeProvider } from '../ThemeProvider'
import { ThemeSwitcher } from '../ThemeSwitcher'

describe('shared number balls', () => {
  it('keeps the same ball presentation and value through theme changes', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
        <ul>
          <LotteryBall value={90} />
        </ul>
        <LotteryBall value={12} as="span" />
      </ThemeProvider>,
    )
    const ball = screen.getByText('90')
    const presentation = ball.className
    expect(ball.tagName).toBe('LI')
    expect(screen.getByText('12').tagName).toBe('SPAN')
    fireEvent.click(screen.getByRole('button', { name: 'Sötét' }))
    expect(ball).toHaveTextContent('90')
    expect(ball.className).toBe(presentation)
  })

  it('provides distinct shared tones for most and least frequent badges', () => {
    render(
      <>
        <LotteryBall value={23} as="span" tone="most" />
        <LotteryBall value={87} as="span" tone="least" />
      </>,
    )

    const most = screen.getByText('23')
    const least = screen.getByText('87')
    expect(most.className).not.toBe(least.className)
    expect(most).toHaveTextContent('23')
    expect(least).toHaveTextContent('87')
  })
})
