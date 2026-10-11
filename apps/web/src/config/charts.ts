export const chartTheme = {
  text: { fill: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12 },
  axis: {
    ticks: {
      text: { fill: 'var(--muted)' },
      line: { stroke: 'var(--border)' },
    },
    domain: { line: { stroke: 'var(--border)' } },
  },
  grid: { line: { stroke: 'var(--border)', strokeOpacity: 0.45 } },
}
