import { LuMoon, LuSun } from 'react-icons/lu'
import { useTheme, type ThemeMode } from '../ThemeProvider'
import styles from './ThemeSwitcher.module.scss'

const options: { mode: ThemeMode; label: string; Icon: typeof LuSun }[] = [
  { mode: 'light', label: 'Világos', Icon: LuSun },
  { mode: 'dark', label: 'Sötét', Icon: LuMoon },
]

export function ThemeSwitcher() {
  const { mode, setMode } = useTheme()
  return (
    <div className={styles.switcher} role="group" aria-label="Téma választása">
      {options.map(({ mode: option, label, Icon }) => (
        <button
          className={styles.option}
          key={option}
          type="button"
          aria-pressed={mode === option}
          onClick={() => setMode(option)}
        >
          <Icon aria-hidden="true" focusable="false" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
