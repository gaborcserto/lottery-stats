import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { gameCodes, gamePages } from '../../config/games'
import { ThemeSwitcher } from '../ThemeSwitcher'
import styles from './AppHeader.module.scss'

export function AppHeader({ pending = false }: { pending?: boolean }) {
  const { pathname } = useLocation()
  const gamePath = pathname.replace(/\/+$/, '')
  const activeIndex = gameCodes.findIndex(
    (code) => gamePages[code].path === gamePath,
  )
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const menuNavigation = useRef<HTMLElement>(null)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 832 && menuOpen) {
        if (document.activeElement === menuButton.current) {
          menuNavigation.current?.querySelector('a')?.focus()
        }
        setMenuOpen(false)
      }
    }
    window.addEventListener('resize', closeOnDesktop)
    return () => window.removeEventListener('resize', closeOnDesktop)
  }, [menuOpen])
  return (
    <header
      className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false)
          menuButton.current?.focus()
        }
      }}
    >
      <a className={styles.skip} href="#main">
        Ugrás a tartalomra
      </a>
      <div className={styles.inner}>
        <NavLink
          className={styles.brand}
          to="/"
          end
          prefetch="intent"
          aria-label="Lottery Stats – Kezdőlap"
        >
          <img
            src="/images/logo.png"
            alt="Lottery Stats"
            width="2172"
            height="724"
          />
        </NavLink>
        <button
          ref={menuButton}
          className={styles.menuToggle}
          type="button"
          aria-label={menuOpen ? 'Menü bezárása' : 'Menü megnyitása'}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span
            className={styles.hamburger}
            data-open={menuOpen}
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
          </span>
        </button>
        <nav
          ref={menuNavigation}
          id="primary-navigation"
          className={styles.navigation}
          aria-label="Fő navigáció"
          aria-busy={pending}
          data-open={menuOpen}
        >
          {gameCodes.map((code) => (
            <NavLink
              key={code}
              to={gamePages[code].path}
              prefetch="intent"
              onClick={() => {
                setMenuOpen(false)
                menuButton.current?.focus()
              }}
            >
              <span>{gamePages[code].name}</span>
            </NavLink>
          ))}
          {activeIndex >= 0 && (
            <span
              className={styles.activePill}
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
              aria-hidden="true"
            />
          )}
        </nav>
        <ThemeSwitcher />
      </div>
    </header>
  )
}
