import {
  FaAnglesLeft,
  FaAngleLeft,
  FaAngleRight,
  FaAnglesRight,
} from 'react-icons/fa6'
import styles from './HistoryPagination.module.scss'

export function HistoryPagination({
  current,
  last,
  busy = false,
  onPageChange,
}: {
  current: number
  last: number
  busy?: boolean
  onPageChange: (page: number) => void
}) {
  const pages = [...new Set([1, current - 1, current, current + 1, last])]
    .filter((page) => page >= 1 && page <= last)
    .sort((a, b) => a - b)
  return (
    <nav
      className={styles.pagination}
      aria-label="Sorsolási előzmények lapozása"
      aria-busy={busy}
    >
      <button
        aria-label="Első oldal"
        type="button"
        disabled={current <= 1 || busy}
        onClick={() => onPageChange(1)}
      >
        <FaAnglesLeft aria-hidden="true" />
      </button>
      <button
        aria-label="Előző oldal"
        type="button"
        disabled={current <= 1 || busy}
        onClick={() => onPageChange(Math.min(current - 1, last))}
      >
        <FaAngleLeft aria-hidden="true" />
      </button>
      {pages.map((page, index) => (
        <span className={styles.item} key={page}>
          {index > 0 && page - pages[index - 1] > 1 && (
            <span className={styles.ellipsis} aria-hidden="true">
              …
            </span>
          )}
          <button
            aria-label={`${page}. oldal`}
            type="button"
            aria-current={current === page ? 'page' : undefined}
            disabled={busy}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        </span>
      ))}
      <button
        aria-label="Következő oldal"
        type="button"
        disabled={current >= last || busy}
        onClick={() => onPageChange(current + 1)}
      >
        <FaAngleRight aria-hidden="true" />
      </button>
      <button
        aria-label="Utolsó oldal"
        type="button"
        disabled={current >= last || busy}
        onClick={() => onPageChange(last)}
      >
        <FaAnglesRight aria-hidden="true" />
      </button>
    </nav>
  )
}
