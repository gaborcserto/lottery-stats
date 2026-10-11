import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import type { GameCode } from '../../api/contracts'
import { parseFilters, type PageFilters } from '../../api/filters'
import styles from './StatisticsFilters.module.scss'

export function StatisticsFilters({
  game,
  filters,
}: {
  game: GameCode
  filters: PageFilters
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
      <h2>Időszak és számsor</h2>
      <form
        key={JSON.stringify({ ...filters.statistics, sort: filters.sort })}
        onSubmit={submit}
        className={styles.form}
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
        <label>
          Kezdő dátum
          <input
            name="from_date"
            type="date"
            defaultValue={filters.population.from_date ?? ''}
            onChange={(event) =>
              event.currentTarget.form
                ?.querySelector<HTMLInputElement>('[name="to_date"]')
                ?.setCustomValidity('')
            }
          />
        </label>
        <label>
          Záró dátum
          <input
            name="to_date"
            type="date"
            defaultValue={filters.population.to_date ?? ''}
            onChange={(event) => event.currentTarget.setCustomValidity('')}
          />
        </label>
        {game === 'scandinavian' && (
          <label>
            Statisztikai számsor
            <select name="set" defaultValue={filters.statistics.set}>
              <option value="machine">Gépi</option>
              <option value="manual">Kézi</option>
              <option value="combined">Gépi és kézi együtt</option>
            </select>
          </label>
        )}
        <label>
          Gyakoriság rendezése
          <select name="sort" defaultValue={filters.sort}>
            <option value="number">Szám szerint</option>
            <option value="most">Leggyakoribb elöl</option>
            <option value="least">Legritkább elöl</option>
          </select>
        </label>
        <button type="submit">Szűrés</button>
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
