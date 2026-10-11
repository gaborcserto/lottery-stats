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
    grid: { line: { stroke: border, strokeOpacity: 0.55 } },
    legends: { text: { fill: muted } },
    tooltip: {
      container: {
        color: text,
        background: tooltipBackground,
        fontFamily: 'var(--font-body)',
        border: `1px solid ${border}`,
      },
    },
  }
}

const chartThemes = {
  light: createChartTheme({
    text: '#172c38',
    muted: '#455b64',
    border: '#becdc3',
    tooltipBackground: '#ffffff',
  }),
  dark: createChartTheme({
    text: '#ecf3ed',
    muted: '#baccc8',
    border: '#557168',
    tooltipBackground: '#203d49',
  }),
}

export function getChartTheme(theme: ResolvedTheme) {
  return chartThemes[theme]
}
