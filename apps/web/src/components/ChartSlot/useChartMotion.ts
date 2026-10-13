import { useState, useSyncExternalStore } from 'react'
import type { ResolvedTheme } from '../ThemeProvider'

const query = '(prefers-reduced-motion: reduce)'
function subscribe(listener: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

function snapshot() {
  return window.matchMedia(query).matches
}

export function useChartMotion(theme: ResolvedTheme) {
  const [motion, setMotion] = useState({ theme, enabled: true })
  if (motion.enabled && motion.theme !== theme) {
    setMotion({ theme, enabled: false })
  }
  const reduced = useSyncExternalStore(subscribe, snapshot, () => true)
  // Theme changes update presentation immediately, without replaying motion.
  return !reduced && motion.enabled && motion.theme === theme
}
