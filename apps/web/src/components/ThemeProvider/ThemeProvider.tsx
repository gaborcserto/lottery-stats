import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ThemeContext } from './theme-context'

export type ThemeMode = 'light' | 'dark'
export type ResolvedTheme = ThemeMode

const STORAGE_KEY = 'lottery-stats-theme'

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setCurrentMode] = useState<ThemeMode>('light')
  const hasUserSelection = useRef(false)

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      // Storage can be disabled by browser privacy settings.
    }

    const restoredMode = isThemeMode(saved) ? saved : 'light'
    applyTheme(restoredMode)
    const restoreTimer = window.setTimeout(() => {
      if (!hasUserSelection.current) setCurrentMode(restoredMode)
    }, 0)

    if (saved === 'system') {
      try {
        window.localStorage.setItem(STORAGE_KEY, 'light')
      } catch {
        // The legacy preference still resolves to Light for this session.
      }
    }

    return () => window.clearTimeout(restoreTimer)
  }, [])

  const setMode = useCallback((nextMode: ThemeMode) => {
    hasUserSelection.current = true
    setCurrentMode(nextMode)
    applyTheme(nextMode)
    try {
      window.localStorage.setItem(STORAGE_KEY, nextMode)
    } catch {
      // The in-memory selection still works when storage is unavailable.
    }
  }, [])

  const value = useMemo(
    () => ({ mode, resolvedTheme: mode, setMode }),
    [mode, setMode],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
