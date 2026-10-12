import { useEffect, useId, useRef, type CSSProperties } from 'react'
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
        onToggle={(event) => {
          const details = event.currentTarget
          if (!details.open) return
          const trigger = details
            .querySelector('summary')
            ?.getBoundingClientRect()
          const panel = details.querySelector<HTMLDivElement>('[role="group"]')
          if (!trigger || !panel) return
          const below = window.innerHeight - trigger.bottom
          details.dataset.side =
            below < panel.offsetHeight + 8 && trigger.top > below
              ? 'above'
              : 'below'
        }}
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
          onKeyDown={(event) => {
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
            const step = steps[event.key]
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? inputs.length - 1
                  : step !== undefined
                    ? Math.max(0, Math.min(inputs.length - 1, index + step))
                    : undefined
            if (next !== undefined) {
              event.preventDefault()
              inputs[next]?.focus()
            }
          }}
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
                  onChange={() => {
                    if (numbers.includes(number)) {
                      if (numbers.length <= minimumSelections) return
                      onChange(numbers.filter((value) => value !== number))
                      return
                    }
                    if (
                      maximumSelections !== undefined &&
                      numbers.length >= maximumSelections
                    )
                      return
                    onChange([...numbers, number].sort((a, b) => a - b))
                  }}
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
