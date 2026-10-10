import type { ReactNode } from 'react'
import { AppHeader } from '../AppHeader'
import { AppFooter } from '../AppFooter'
import styles from './AppLayout.module.scss'

export function AppLayout({
  children,
  pending = false,
}: {
  children: ReactNode
  pending?: boolean
}) {
  return (
    <div className={styles.layout}>
      <AppHeader />
      <main id="main" tabIndex={-1} className={styles.main} aria-busy={pending}>
        {pending && <p role="status">Az oldal betöltése…</p>}
        {children}
      </main>
      <AppFooter />
    </div>
  )
}
