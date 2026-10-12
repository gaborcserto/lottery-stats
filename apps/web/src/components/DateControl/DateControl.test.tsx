import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { DateControl } from '.'

const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
)
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
)

// jsdom does not implement dialog methods; browser checks cover the native focus trap and Escape.
beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false
        this.dispatchEvent(new Event('close'))
      },
    },
  })
})

afterEach(() => {
  for (const [name, descriptor] of [
    ['showModal', originalShowModal],
    ['close', originalClose],
  ] as const) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
})

function setup(defaultValue = '2024-02-29') {
  const onValueChange = vi.fn()
  render(
    <form aria-label="Szűrők">
      <label htmlFor="date">Kezdő dátum</label>
      <DateControl
        id="date"
        name="from_date"
        label="Kezdő dátum"
        defaultValue={defaultValue}
        onValueChange={onValueChange}
      />
    </form>,
  )
  return {
    onValueChange,
    input: screen.getByLabelText('Kezdő dátum'),
    trigger: screen.getByRole('button', {
      name: 'Kezdő dátum: naptár megnyitása',
    }),
  }
}

describe('date calendar', () => {
  it('selects a leap day through the keyboard and preserves the form value', () => {
    const { input, trigger, onValueChange } = setup('2024-02-28')
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toHaveAccessibleName(
      'Kezdő dátum: 2024. február',
    )
    expect(
      screen.getByRole('button', { name: '2024. február 28., szerda' }),
    ).toHaveFocus()
    fireEvent.keyDown(document.activeElement ?? input, { key: 'ArrowRight' })
    const leapDay = screen.getByRole('button', {
      name: '2024. február 29., csütörtök',
    })
    expect(leapDay).toHaveFocus()
    fireEvent.click(leapDay)
    expect(input).toHaveValue('2024-02-29')
    expect(
      new FormData(screen.getByRole<HTMLFormElement>('form')).get('from_date'),
    ).toBe('2024-02-29')
    expect(onValueChange).toHaveBeenCalledWith(input)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('clamps month navigation to real dates and leaves the value unchanged on dismissal', () => {
    const { input, trigger } = setup('2024-01-31')
    fireEvent.click(trigger)
    fireEvent.keyDown(document.activeElement ?? input, { key: 'PageDown' })
    expect(
      screen.getByRole('button', { name: '2024. február 29., csütörtök' }),
    ).toHaveFocus()
    fireEvent.keyDown(document.activeElement ?? input, { key: 'ArrowRight' })
    expect(
      screen.getByRole('button', { name: '2024. március 1., péntek' }),
    ).toHaveFocus()
    const close = screen.getByRole('button', { name: 'Bezárás' })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab' })
    const previous = screen.getByRole('button', { name: 'Előző hónap' })
    expect(previous).toHaveFocus()
    fireEvent.keyDown(previous, { key: 'Tab', shiftKey: true })
    expect(close).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
    expect(input).toHaveValue('2024-01-31')
    expect(trigger).toHaveFocus()
  })

  it('keeps typed input, clearing and year boundaries usable', () => {
    const { input, trigger, onValueChange } = setup('0001-01-01')
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Előző hónap' })).toBeDisabled()
    fireEvent.keyDown(document.activeElement ?? input, { key: 'ArrowLeft' })
    expect(
      screen.getByRole('button', { name: '1. január 1., hétfő' }),
    ).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Törlés' }))
    expect(input).toHaveValue('')
    fireEvent.change(input, { target: { value: '2025-10-12' } })
    expect(input).toHaveValue('2025-10-12')
    expect(onValueChange).toHaveBeenCalledTimes(2)
    fireEvent.click(trigger)
    expect(
      screen.getByRole('button', { name: '2025. október 12., vasárnap' }),
    ).toHaveFocus()
  })
})
