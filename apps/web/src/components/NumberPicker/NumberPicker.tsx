import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { LuCheck, LuX } from 'react-icons/lu'
import { FaChevronDown } from 'react-icons/fa6'
import styles from './NumberPicker.module.scss'

export function NumberPicker({
  maximum,
  numbers,
  onChange,
  colorForNumber,
  maximumSelections,
  minimumSelections = 1,
  disabled = false,
}: {
  maximum: number
  numbers: number[]
  onChange: (numbers: number[]) => void
  colorForNumber: (number: number) => string
  maximumSelections?: number
  minimumSelections?: number
  disabled?: boolean
}) {
  const disclosure = useRef<HTMLDetailsElement>(null)
  const id = useId()

  function handleDisclosureToggle(details: HTMLDetailsElement) {
    if (!details.open) return

    const trigger = details.querySelector('summary')?.getBoundingClientRect()
    const panel = details.querySelector<HTMLDivElement>('[role="group"]')
    if (!trigger || !panel) return

    const spaceBelow = window.innerHeight - trigger.bottom
    details.dataset.side =
      spaceBelow < panel.offsetHeight + 8 && trigger.top > spaceBelow
        ? 'above'
        : 'below'
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const inputs = Array.from(
      event.currentTarget.querySelectorAll<HTMLInputElement>(
        'input:not(:disabled)',
      ),
    )
    const index = inputs.findIndex((input) => input === event.target)
    if (index < 0) return

    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 5,
      ArrowUp: -5,
    }
    let next: number | undefined

    if (event.key === 'Home') {
      next = 0
    } else if (event.key === 'End') {
      next = inputs.length - 1
    } else if (steps[event.key] !== undefined) {
      next = Math.max(
        0,
        Math.min(inputs.length - 1, index + (steps[event.key] ?? 0)),
      )
    }

    if (next === undefined) return
    event.preventDefault()
    inputs[next]?.focus()
  }

  function changeNumber(number: number) {
    if (numbers.includes(number)) {
      if (numbers.length <= minimumSelections) return
      onChange(numbers.filter((value) => value !== number))
      return
    }

    if (maximumSelections !== undefined && numbers.length >= maximumSelections)
      return

    onChange([...numbers, number].sort((a, b) => a - b))
  }

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !disclosure.current?.contains(event.target)
      ) {
        disclosure.current?.removeAttribute('open')
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  return (
    <div className={styles.picker}>
      <span id={`${id}-label`} className={styles.label}>
        Vizsgált számok
      </span>
      <details
        ref={disclosure}
        className={styles.disclosure}
        onToggle={(event) => handleDisclosureToggle(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            disclosure.current?.removeAttribute('open')
            disclosure.current?.querySelector('summary')?.focus()
          }
        }}
      >
        <summary
          aria-label="Éves gyakoriságban vizsgált számok"
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) event.preventDefault()
          }}
        >
          <span>
            Számok kiválasztása <small>({numbers.length})</small>
          </span>
          <FaChevronDown className={styles.caret} aria-hidden="true" />
        </summary>
        <div
          className={styles.options}
          role="group"
          aria-labelledby={`${id}-label`}
          onKeyDown={handleOptionKeyDown}
        >
          {Array.from({ length: maximum }, (_, index) => index + 1).map(
            (number) => (
              <label key={number} className={styles.option}>
                <input
                  type="checkbox"
                  aria-label={`${number}. szám`}
                  checked={numbers.includes(number)}
                  disabled={
                    disabled ||
                    (numbers.includes(number) &&
                      numbers.length <= minimumSelections) ||
                    (!numbers.includes(number) &&
                      maximumSelections !== undefined &&
                      numbers.length >= maximumSelections)
                  }
                  onChange={() => changeNumber(number)}
                />
                <span>{number}</span>
                <LuCheck aria-hidden="true" />
              </label>
            ),
          )}
        </div>
      </details>
      {maximumSelections !== undefined &&
        numbers.length >= maximumSelections && (
          <p role="status">
            Legfeljebb {maximumSelections} szám hasonlítható össze egyszerre.
          </p>
        )}
      {numbers.length <= minimumSelections && (
        <p role="status">
          Legalább {minimumSelections} számot kell kiválasztani az
          összehasonlításhoz.
        </p>
      )}
      <ul className={styles.chips} aria-label="Kiválasztott számok">
        {numbers.map((number) => {
          const style: CSSProperties & { '--series-color': string } = {
            '--series-color': colorForNumber(number),
          }
          return (
            <li key={number} style={style}>
              <span className={styles.swatch} aria-hidden="true" />
              <span>{number}</span>
              <button
                type="button"
                disabled={disabled || numbers.length <= minimumSelections}
                aria-label={`${number}. szám eltávolítása`}
                onClick={(event) => {
                  if (numbers.length <= minimumSelections) return
                  onChange(numbers.filter((value) => value !== number))
                  if (numbers.length - 1 <= minimumSelections) {
                    disclosure.current?.querySelector('summary')?.focus()
                    return
                  }
                  const nextChip =
                    event.currentTarget.closest('li')?.nextElementSibling ??
                    event.currentTarget.closest('li')?.previousElementSibling
                  const nextButton = nextChip?.querySelector('button')
                  if (nextButton) nextButton.focus()
                  else disclosure.current?.querySelector('summary')?.focus()
                }}
              >
                <LuX aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
