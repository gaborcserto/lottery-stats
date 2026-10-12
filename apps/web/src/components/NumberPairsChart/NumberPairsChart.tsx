import { SelectControl } from '../SelectControl'
import { ResponsiveBar } from '@nivo/bar'
import { useMemo, useState } from 'react'
import type { GamePageData } from '../../api/page-data'
import { getChartTheme } from '../../config/charts'
import { useTheme } from '../ThemeProvider'
import { useChartMotion } from '../ChartSlot'
import styles from './NumberPairsChart.module.scss'

export function NumberPairsChart({
  data,
}: {
  data: NonNullable<GamePageData['pairs']>['data']
}) {
  const { resolvedTheme } = useTheme()
  const chartTheme = getChartTheme(resolvedTheme)
  const animate = useChartMotion(resolvedTheme)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const rows = useMemo(
    () =>
      data.map((row) => ({
        ...row,
        pair: `${row.first_number} + ${row.second_number}`,
      })),
    [data],
  )
  const selectedPair = rows.some((row) => row.pair === selected)
    ? selected
    : null
  const active = hovered ?? selectedPair
  const selection = rows.find((row) => row.pair === active)
  return (
    <div className={styles.chart}>
      <label className={styles.selection}>
        Kiemelt pár{' '}
        <SelectControl
          aria-label="Kiemelt pár"
          value={selectedPair ?? ''}
          onChange={(event) => setSelected(event.currentTarget.value || null)}
        >
          <option value="">Összes pár</option>
          {rows.map((row) => (
            <option key={row.pair} value={row.pair}>
              {row.pair}
            </option>
          ))}
        </SelectControl>
        {selection && (
          <span>
            {' '}
            · {selection.count} előfordulás · {selection.occurrence_percentage}%
          </span>
        )}
      </label>
      <div className={styles.canvas}>
        <ResponsiveBar
          theme={chartTheme}
          data={rows}
          keys={['count']}
          indexBy="pair"
          layout="horizontal"
          margin={{ top: 8, right: 20, bottom: 38, left: 70 }}
          padding={0.25}
          colors={(bar) =>
            active === null || active === bar.data.pair
              ? 'var(--chart-primary)'
              : 'var(--chart-muted)'
          }
          borderRadius={3}
          enableLabel={false}
          animate={animate}
          motionConfig={{ duration: 350 }}
          isFocusable
          barAriaLabel={(bar) =>
            `${bar.data.pair}: ${bar.data.count} előfordulás, ${bar.data.occurrence_percentage}%`
          }
          onMouseEnter={(bar) => setHovered(bar.data.pair)}
          onMouseLeave={() => setHovered(null)}
          onClick={(bar) => setSelected(bar.data.pair)}
          tooltip={({ data: row }) => (
            <div className={styles.tooltip}>
              {row.pair}: {row.count} előfordulás · {row.occurrence_percentage}%
            </div>
          )}
        />
      </div>
    </div>
  )
}
