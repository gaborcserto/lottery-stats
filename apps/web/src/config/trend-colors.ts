import type { ResolvedTheme } from '../components/ThemeProvider'

const lightSeriesColors = [
  'var(--accent-lime)',
  '#2563eb',
  '#d97706',
  '#be185d',
  '#0f766e',
  '#7c3aed',
  '#b91c1c',
  '#0e7490',
  '#a16207',
  '#4d7c0f',
  '#6d28d9',
  '#334155',
]
const darkSeriesColors = [
  'var(--accent-lime)',
  '#60a5fa',
  '#fbbf24',
  '#f472b6',
  '#2dd4bf',
  '#c4b5fd',
  '#fb7185',
  '#22d3ee',
  '#facc15',
  '#bef264',
  '#d8b4fe',
  '#cbd5e1',
]

export function getTrendColors(theme: ResolvedTheme) {
  return theme === 'dark' ? darkSeriesColors : lightSeriesColors
}
