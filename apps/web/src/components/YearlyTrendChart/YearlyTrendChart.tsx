import { chartTheme } from '../../config/charts'
import { ResponsiveLine, type LineCustomSvgLayerProps } from '@nivo/line'
import type { GamePageData } from '../../api/page-data'
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
      fill="#c4e86b"
      stroke="#102b3e"
      strokeWidth={2}
      pointerEvents="none"
    />
  ) : null
}

export function YearlyTrendChart({
  data,
  number,
}: {
  data: NonNullable<GamePageData['yearly']>['data']
  number: number
}) {
  return (
    <div className={styles.chart}>
      <ResponsiveLine<TrendSeries>
        theme={chartTheme}
        data={[{ id: `${number}. szám`, data: mapYearlyTrend(data) }]}
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
          tickValues: data.length === 1 ? [data[0].year] : 5,
          format: (value) => String(Math.round(Number(value))),
          tickRotation: -25,
        }}
        colors={['#176039']}
        lineWidth={3}
        pointSize={8}
        pointBorderWidth={2}
        pointBorderColor="#102b3e"
        enableArea={false}
        useMesh
        enableTouchCrosshair
        isFocusable
        animate={false}
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
  )
}
