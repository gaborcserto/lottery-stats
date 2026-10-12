import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NumberPicker } from '.'

function Picker() {
  const [numbers, setNumbers] = useState([1, 12])
  return (
    <NumberPicker
      maximum={35}
      numbers={numbers}
      onChange={setNumbers}
      colorForNumber={(number) => (number === 1 ? '#74bf1e' : '#2563eb')}
    />
  )
}

describe('number picker', () => {
  it('opens above the trigger when the viewport has more room there', () => {
    render(<Picker />)
    const trigger = screen.getByLabelText('Éves gyakoriságban vizsgált számok')
    const details = trigger.closest('details')
    const panel = details?.querySelector('[role="group"]')
    if (!details || !panel) throw new Error('Missing picker disclosure')
    const rect = vi
      .spyOn(trigger, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, window.innerHeight - 68, 300, 44))
    Object.defineProperty(panel, 'offsetHeight', { value: 288 })
    details.open = true
    fireEvent(details, new Event('toggle'))
    expect(details).toHaveAttribute('data-side', 'above')
    rect.mockReturnValue(new DOMRect(0, 100, 300, 44))
    fireEvent(details, new Event('toggle'))
    expect(details).toHaveAttribute('data-side', 'below')
    rect.mockRestore()
  })
  it('selects independently, navigates by keyboard and closes with Escape', () => {
    render(<Picker />)
    const trigger = screen.getByLabelText('Éves gyakoriságban vizsgált számok')
    const details = trigger.closest('details')
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(trigger)
    expect(details).toHaveAttribute('open')
    const first = screen.getByRole('checkbox', { name: '1. szám' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    const sixth = screen.getByRole('checkbox', { name: '6. szám' })
    expect(sixth).toHaveFocus()
    fireEvent.click(sixth)
    expect(sixth).toBeChecked()
    expect(first).toBeChecked()
    fireEvent.keyDown(sixth, { key: 'Escape' })
    expect(details).not.toHaveAttribute('open')
    expect(trigger).toHaveFocus()
  })
  it('colors chips, removes a number and moves focus to the next removal action', () => {
    render(<Picker />)
    const remove = screen.getByRole('button', { name: '1. szám eltávolítása' })
    expect(remove.closest('li')?.style.getPropertyValue('--series-color')).toBe(
      '#74bf1e',
    )
    remove.focus()
    fireEvent.click(remove)
    expect(
      screen.queryByRole('button', { name: '1. szám eltávolítása' }),
    ).not.toBeInTheDocument()
    const last = screen.getByRole('button', { name: '12. szám eltávolítása' })
    expect(last).toHaveFocus()
    expect(last.closest('li')?.style.getPropertyValue('--series-color')).toBe(
      '#2563eb',
    )
    fireEvent.click(last)
    expect(
      screen.getByLabelText('Éves gyakoriságban vizsgált számok'),
    ).toHaveFocus()
  })
  it('dismisses outside the picker and blocks disabled selection', () => {
    const change = vi.fn()
    const { rerender } = render(<Picker />)
    const trigger = screen.getByLabelText('Éves gyakoriságban vizsgált számok')
    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(trigger.closest('details')).not.toHaveAttribute('open')
    rerender(
      <NumberPicker
        maximum={35}
        numbers={[1]}
        onChange={change}
        colorForNumber={() => '#74bf1e'}
        disabled
      />,
    )
    fireEvent.click(screen.getByLabelText('Éves gyakoriságban vizsgált számok'))
    expect(
      screen
        .getByLabelText('Éves gyakoriságban vizsgált számok')
        .closest('details'),
    ).not.toHaveAttribute('open')
    expect(
      screen.getByRole('button', { name: '1. szám eltávolítása' }),
    ).toBeDisabled()
    expect(change).not.toHaveBeenCalled()
  })
})
