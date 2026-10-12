import { useEffect, useId, useRef, useState } from 'react'
import { LuCalendarDays } from 'react-icons/lu'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa6'
import styles from './DateControl.module.scss'

function dateAt(year: number, month: number, day: number) {
  const date = new Date(0)
  date.setHours(12, 0, 0, 0)
  date.setFullYear(year, month, day)
  return date
}

function dateValue(date: Date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shiftMonth(date: Date, amount: number) {
  const last = dateAt(date.getFullYear(), date.getMonth() + amount + 1, 0)
  return dateAt(
    last.getFullYear(),
    last.getMonth(),
    Math.min(date.getDate(), last.getDate()),
  )
}

export function DateControl({
  id,
  name,
  label,
  defaultValue,
  onValueChange,
}: {
  id: string
  name: string
  label: string
  defaultValue: string
  onValueChange: (input: HTMLInputElement) => void
}) {
  const popupId = useId()
  const headingId = useId()
  const helpId = useId()
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const focusDay = useRef(false)
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => dateAt(2000, 0, 1))
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = dateAt(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, index) =>
    dateAt(year, month, index - offset + 1),
  )

  useEffect(() => {
    if (open && focusDay.current) {
      dialog.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${dateValue(cursor)}"]`)
        ?.focus()
      focusDay.current = false
    }
  }, [cursor, open])

  function move(next: Date, shouldFocusDay = true) {
    if (next.getFullYear() >= 1 && next.getFullYear() <= 9999) {
      focusDay.current = shouldFocusDay
      setCursor(next)
    }
  }

  function change(next: string) {
    setValue(next)
    if (input.current) {
      input.current.value = next
      onValueChange(input.current)
    }
  }

  function showCalendar() {
    if (!dialog.current || !input.current) return
    // Preserve the native picker as a fallback in browsers without dialog support.
    if (typeof dialog.current.showModal !== 'function') {
      input.current.showPicker?.()
      return
    }
    const selected = input.current.value
    const next = selected ? new Date(`${selected}T12:00:00`) : new Date()
    focusDay.current = true
    setCursor(
      next.getFullYear() >= 1 && next.getFullYear() <= 9999 ? next : new Date(),
    )
    dialog.current.showModal()
    const rect = input.current.getBoundingClientRect()
    const popup = dialog.current.getBoundingClientRect()
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - popup.width - 8),
    )
    const below = rect.bottom + 6
    const top =
      below + popup.height <= window.innerHeight - 8
        ? below
        : Math.max(8, rect.top - popup.height - 6)
    dialog.current.style.left = `${left}px`
    dialog.current.style.top = `${top}px`
    setOpen(true)
  }

  return (
    <div className={styles.control}>
      <input
        ref={input}
        id={id}
        name={name}
        type="date"
        min="0001-01-01"
        max="9999-12-31"
        value={value}
        data-filled={Boolean(value)}
        onChange={(event) => {
          setValue(event.currentTarget.value)
          onValueChange(event.currentTarget)
        }}
      />
      <button
        ref={trigger}
        className={styles.trigger}
        type="button"
        aria-label={`${label}: naptár megnyitása`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popupId}
        onClick={showCalendar}
      >
        <LuCalendarDays aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        id={popupId}
        className={styles.popup}
        aria-labelledby={headingId}
        aria-describedby={helpId}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const buttons =
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button:not(:disabled):not([tabindex="-1"])',
            )
          const first = buttons[0]
          const last = buttons[buttons.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
        onClose={() => {
          setOpen(false)
          trigger.current?.focus()
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          const rect = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          ) {
            event.currentTarget.close()
          }
        }}
      >
        <div className={styles.heading}>
          <button
            type="button"
            aria-label="Előző hónap"
            disabled={year === 1 && month === 0}
            onClick={() => move(shiftMonth(cursor, -1), false)}
          >
            <FaChevronLeft aria-hidden="true" />
          </button>
          <h3 id={headingId} aria-live="polite">
            <span className={styles.visuallyHidden}>{label}:</span>{' '}
            {new Intl.DateTimeFormat('hu-HU', {
              year: 'numeric',
              month: 'long',
            }).format(cursor)}
          </h3>
          <button
            type="button"
            aria-label="Következő hónap"
            disabled={year === 9999 && month === 11}
            onClick={() => move(shiftMonth(cursor, 1), false)}
          >
            <FaChevronRight aria-hidden="true" />
          </button>
        </div>
        <p id={helpId} className={styles.visuallyHidden}>
          A nyílbillentyűkkel választhatsz napot, a Page Up és Page Down hónapot
          vált. Az Enter kiválasztja a dátumot, az Escape bezárja a naptárt.
        </p>
        <div className={styles.weekdays} aria-hidden="true">
          {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className={styles.days} role="group" aria-label="Nap kiválasztása">
          {days.map((day) => {
            const iso = dateValue(day)
            return (
              <button
                key={iso}
                type="button"
                data-date={iso}
                data-outside={day.getMonth() !== month}
                aria-label={new Intl.DateTimeFormat('hu-HU', {
                  dateStyle: 'full',
                }).format(day)}
                aria-pressed={value === iso}
                tabIndex={iso === dateValue(cursor) ? 0 : -1}
                disabled={day.getFullYear() < 1 || day.getFullYear() > 9999}
                onClick={() => {
                  change(iso)
                  dialog.current?.close()
                }}
                onKeyDown={(event) => {
                  const weekday = (day.getDay() + 6) % 7
                  const steps: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                    Home: -weekday,
                    End: 6 - weekday,
                  }
                  if (event.key in steps) {
                    event.preventDefault()
                    move(dateAt(year, month, day.getDate() + steps[event.key]))
                  } else if (
                    event.key === 'PageUp' ||
                    event.key === 'PageDown'
                  ) {
                    event.preventDefault()
                    move(
                      shiftMonth(
                        day,
                        (event.key === 'PageUp' ? -1 : 1) *
                          (event.shiftKey ? 12 : 1),
                      ),
                    )
                  }
                }}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => {
              change('')
              dialog.current?.close()
            }}
          >
            Törlés
          </button>
          <button type="button" onClick={() => dialog.current?.close()}>
            Bezárás
          </button>
        </div>
      </dialog>
    </div>
  )
}
