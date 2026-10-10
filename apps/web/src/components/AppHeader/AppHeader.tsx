import { NavLink } from 'react-router'
import { gameCodes, gamePages } from '../../config/games'
import styles from './AppHeader.module.scss'

export function AppHeader() {
  return (
    <header className={styles.header}>
      <a className={styles.skip} href="#main">
        Ugrás a tartalomra
      </a>
      <nav aria-label="Fő navigáció">
        <NavLink to="/" end prefetch="intent">
          Lottery Stats – Kezdőlap
        </NavLink>
        {gameCodes.map((code) => (
          <NavLink key={code} to={gamePages[code].path} prefetch="intent">
            {gamePages[code].name}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
