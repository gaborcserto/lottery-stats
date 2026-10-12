import { SelectControl } from '../SelectControl'
import { DateControl } from '../DateControl'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { FaFilter } from 'react-icons/fa6'
import type { GameCode } from '../../api/contracts'
import { parseFilters, type PageFilters } from '../../api/filters'
import styles from './StatisticsFilters.module.scss'

export function StatisticsFilters({
  game,
  filters,
  pending = false,
}: {
  game: GameCode
  filters: PageFilters
  pending?: boolean
}) {
  const [params, setParams] = useSearchParams()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const next = new URLSearchParams(params)
    for (const key of ['year', 'week', 'from_date', 'to_date', 'set', 'sort']) {
      const value = values.get(key)
      if (typeof value === 'string' && value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('page')
    const valid = parseFilters(next, game)
    if (values.get('to_date') && !valid.population.to_date) {
      event.currentTarget
        .querySelector<HTMLInputElement>('[name="to_date"]')
        ?.setCustomValidity('A záró dátum nem lehet korábbi a kezdő dátumnál.')
      event.currentTarget.reportValidity()
      return
    }
    if (next.toString() !== params.toString())
      setParams(next, { preventScrollReset: true })
  }
  return (
    <section className={styles.panel} aria-label="Statisztikai szűrők">
      <h2>
        <FaFilter aria-hidden="true" /> Időszak és számsor
      </h2>
      <form
        key={JSON.stringify({ ...filters.statistics, sort: filters.sort })}
        onSubmit={submit}
        className={styles.form}
        aria-busy={pending}
      >
        <label>
          Év
          <input
            name="year"
            type="number"
            min="1"
            max="9999"
            defaultValue={filters.population.year ?? ''}
            placeholder="Összes év"
          />
        </label>
        <label>
          Hét
          <input
            name="week"
            type="number"
            min="1"
            max="53"
            defaultValue={filters.population.week ?? ''}
            placeholder="Összes hét"
          />
        </label>
        <div className={styles.field}>
          <label htmlFor="from-date">Kezdő dátum</label>
          <DateControl
            id="from-date"
            label="Kezdő dátum"
            name="from_date"
            defaultValue={filters.population.from_date ?? ''}
            onValueChange={(input) => {
              input.form
                ?.querySelector<HTMLInputElement>('[name="to_date"]')
                ?.setCustomValidity('')
            }}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="to-date">Záró dátum</label>
          <DateControl
            id="to-date"
            label="Záró dátum"
            name="to_date"
            defaultValue={filters.population.to_date ?? ''}
            onValueChange={(input) => input.setCustomValidity('')}
          />
        </div>
        {game === 'scandinavian' && (
          <label>
            Statisztikai számsor
            <SelectControl
              aria-label="Statisztikai számsor"
              name="set"
              defaultValue={filters.statistics.set}
            >
              <option value="machine">Gépi</option>
              <option value="manual">Kézi</option>
              <option value="combined">Gépi és kézi együtt</option>
            </SelectControl>
          </label>
        )}
        <label>
          Gyakoriság rendezése
          <SelectControl
            aria-label="Gyakoriság rendezése"
            name="sort"
            defaultValue={filters.sort}
          >
            <option value="number">Szám szerint</option>
            <option value="most">Leggyakoribb elöl</option>
            <option value="least">Legritkább elöl</option>
          </SelectControl>
        </label>
        <button type="submit" disabled={pending}>
          {pending && <span className={styles.spinner} aria-hidden="true" />}
          {pending ? 'Szűrés folyamatban…' : 'Szűrés'}
        </button>
        <button
          type="button"
          onClick={() => setParams({}, { preventScrollReset: true })}
        >
          Alaphelyzet
        </button>
      </form>
      <p>
        A szűrők metszete érvényesül. A dátumszűrés kizárja az ismeretlen dátumú
        sorsolásokat.
      </p>
    </section>
  )
}
