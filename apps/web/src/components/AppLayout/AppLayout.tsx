import type { ReactNode } from 'react'
import { AppHeader } from '../AppHeader'
import { AppFooter } from '../AppFooter'
import { ThemeProvider } from '../ThemeProvider'
import styles from './AppLayout.module.scss'

export function AppLayout({
  children,
  pending = false,
}: {
  children: ReactNode
  pending?: boolean
}) {
  return (
    <ThemeProvider>
      <div className={styles.layout}>
        <AppHeader pending={pending} />
        <main
          id="main"
          tabIndex={-1}
          className={styles.main}
          aria-busy={pending}
        >
          {children}
        </main>
        <AppFooter />
      </div>
    </ThemeProvider>
  )
}
