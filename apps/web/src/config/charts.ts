import type { ResolvedTheme } from '../components/ThemeProvider'

function createChartTheme(colors: {
  text: string
  muted: string
  border: string
  tooltipBackground: string
}) {
  const { text, muted, border, tooltipBackground } = colors
  return {
    text: { fill: text, fontFamily: 'var(--font-body)', fontSize: 12 },
    axis: {
      ticks: {
        text: { fill: muted },
        line: { stroke: border },
      },
      domain: { line: { stroke: border } },
    },
    grid: { line: { stroke: border, strokeOpacity: 0.4 } },
    legends: { text: { fill: muted } },
    tooltip: {
      container: {
        color: text,
        background: tooltipBackground,
        fontFamily: 'var(--font-body)',
        border: `1px solid ${border}`,
        borderRadius: 8,
        boxShadow: '0 4px 12px rgb(4 18 25 / 12%)',
      },
    },
  }
}

const chartThemes = {
  light: createChartTheme({
    text: '#182938',
    muted: '#4c6078',
    border: '#dce5ef',
    tooltipBackground: '#ffffff',
  }),
  dark: createChartTheme({
    text: '#edf3f8',
    muted: '#bac9d3',
    border: '#2a414d',
    tooltipBackground: '#172d38',
  }),
}

export function getChartTheme(theme: ResolvedTheme) {
  return chartThemes[theme]
}
