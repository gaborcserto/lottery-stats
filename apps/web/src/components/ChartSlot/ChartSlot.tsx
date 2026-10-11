import {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import styles from './ChartSlot.module.scss'
import { useHydrated } from '../../api/use-hydrated'

class ChartError extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <p className={styles.placeholder}>
        Az ábra nem tölthető be. Az adatok szövegesen továbbra is elérhetők.{' '}
        <button onClick={() => window.location.reload()}>Újratöltés</button>
      </p>
    ) : (
      this.props.children
    )
  }
}
export function ChartSlot({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const hydrated = useHydrated()
  useEffect(() => {
    if (!ref.current) return
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '160px' },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  const placeholder = (
    <p className={styles.placeholder}>Az interaktív ábra betöltése…</p>
  )
  return (
    <div ref={ref} className={styles.slot} aria-label={label}>
      {visible || (hydrated && !('IntersectionObserver' in window)) ? (
        <ChartError>
          <Suspense fallback={placeholder}>{children}</Suspense>
        </ChartError>
      ) : (
        <div className={styles.placeholder}>
          <span>Interaktív ábra</span>
          <noscript>
            Az ábrához JavaScript szükséges; az adatok alább olvashatók.
          </noscript>
        </div>
      )}
    </div>
  )
}
