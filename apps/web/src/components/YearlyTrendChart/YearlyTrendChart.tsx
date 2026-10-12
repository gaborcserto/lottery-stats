import { getTrendColors } from '../../config/trend-colors'
import { ResponsiveLine, type LineCustomSvgLayerProps } from '@nivo/line'
import { useMemo } from 'react'
import type { GamePageData } from '../../api/page-data'
import { getChartTheme } from '../../config/charts'
import { useTheme } from '../ThemeProvider'
import { useChartMotion } from '../ChartSlot'
import styles from './YearlyTrendChart.module.scss'
import { mapYearlyTrend } from './mapping'

type TrendSeries = { id: string; data: { x: number; y: number | null }[] }
function ActivePoint({ currentPoint }: LineCustomSvgLayerProps<TrendSeries>) {
  return currentPoint ? (
    <circle
      className={styles.active}
      cx={currentPoint.x}
      cy={currentPoint.y}
      r={7}
      fill={currentPoint.color}
      stroke="var(--heading)"
      strokeWidth={2}
      pointerEvents="none"
    />
  ) : null
}

export function YearlyTrendChart({
  series: selectedSeries,
}: {
  series: {
    number: number
    data: NonNullable<GamePageData['yearly']>['data']
  }[]
}) {
  const { resolvedTheme } = useTheme()
  const chartTheme = getChartTheme(resolvedTheme)
  const animate = useChartMotion(resolvedTheme)
  const seriesColors = getTrendColors(resolvedTheme)
  const series = useMemo(
    () =>
      selectedSeries.map(({ number, data }) => ({
        id: `${number}. szám`,
        data: mapYearlyTrend(data),
      })),
    [selectedSeries],
  )
  return (
    <div className={styles.chart}>
      <div className={styles.plot}>
        <ResponsiveLine<TrendSeries>
          theme={chartTheme}
          data={series}
          layers={[
            'grid',
            'axes',
            'lines',
            'points',
            'crosshair',
            'mesh',
            ActivePoint,
          ]}
          margin={{ top: 20, right: 24, bottom: 48, left: 48 }}
          xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
          yScale={{ type: 'linear', min: 0, max: 'auto' }}
          axisBottom={{
            tickValues:
              series[0]?.data.length === 1 ? [series[0].data[0].x] : 5,
            format: (value) => String(Math.round(Number(value))),
            tickRotation: -25,
          }}
          colors={seriesColors}
          lineWidth={3}
          pointSize={8}
          pointBorderWidth={2}
          pointBorderColor="var(--heading)"
          enableArea={false}
          useMesh
          enableTouchCrosshair
          isFocusable
          animate={animate}
          motionConfig={{ duration: 350 }}
          pointAriaLabel={(point) =>
            `${point.data.x} év: ${point.data.y} előfordulás`
          }
          tooltip={({ point }) => (
            <div className={styles.tooltip}>
              {point.data.xFormatted}. év · {point.data.yFormatted} előfordulás
            </div>
          )}
        />
      </div>
      <ul className={styles.legend} aria-label="Éves gyakorisági jelmagyarázat">
        {selectedSeries.map(({ number }, index) => (
          <li key={number}>
            <span
              style={{
                backgroundColor: seriesColors[index % seriesColors.length],
              }}
            />
            {number}. szám
          </li>
        ))}
      </ul>
    </div>
  )
}
