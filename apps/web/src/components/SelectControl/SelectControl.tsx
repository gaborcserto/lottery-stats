import type { SelectHTMLAttributes } from 'react'
import { FaChevronDown } from 'react-icons/fa6'
import styles from './SelectControl.module.scss'

export function SelectControl(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={styles.control}>
      <select {...props} />
      <FaChevronDown className={styles.caret} aria-hidden="true" />
    </span>
  )
}
