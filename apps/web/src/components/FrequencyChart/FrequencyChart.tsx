import { SelectControl } from '../SelectControl'
import { useState, type CSSProperties } from 'react'
import { ResponsiveBar } from '@nivo/bar'
import type { GamePageData } from '../../api/page-data'
import { getChartTheme } from '../../config/charts'
import { useTheme } from '../ThemeProvider'
import { useChartMotion } from '../ChartSlot'
import styles from './FrequencyChart.module.scss'

export function FrequencyChart({
  data,
}: {
  data: GamePageData['frequencies']['data']
}) {
  const { resolvedTheme } = useTheme()
  const chartTheme = getChartTheme(resolvedTheme)
  const animate = useChartMotion(resolvedTheme)
  const [selected, setSelected] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const active = hovered ?? selected
  return (
    <div className={styles.chart}>
      <label className={styles.hint}>
        Kiemelt szám{' '}
        <SelectControl
          aria-label="Kiemelt szám"
          value={selected ?? ''}
          onChange={(event) =>
            setSelected(
              event.currentTarget.value
                ? Number(event.currentTarget.value)
                : null,
            )
          }
        >
          <option value="">Összes szám</option>
          {data.map((row) => (
            <option key={row.number} value={row.number}>
              {row.number}
            </option>
          ))}
        </SelectControl>{' '}
        <span className={styles.mobileHint}>
          {' '}
          · Mobilon az ábra oldalra görgethető.
        </span>
      </label>
      <div
        className={styles.scroll}
        tabIndex={0}
        aria-label="Számgyakorisági ábra"
      >
        <div
          className={styles.canvas}
          style={
            {
              '--mobile-chart-width': `${Math.max(480, data.length * 24)}px`,
            } as CSSProperties
          }
        >
          <ResponsiveBar
            theme={chartTheme}
            data={data}
            keys={['count']}
            indexBy="number"
            margin={{ top: 12, right: 12, bottom: 42, left: 52 }}
            padding={0.28}
            colors={(bar) =>
              active === null || active === bar.data.number
                ? 'var(--chart-primary)'
                : 'var(--chart-muted)'
            }
            borderRadius={3}
            borderWidth={active === null ? 0 : 2}
            borderColor="var(--heading)"
            enableLabel={false}
            axisLeft={{ tickSize: 0, tickPadding: 8 }}
            axisBottom={{
              tickSize: 0,
              tickPadding: 10,
              tickValues: data
                .filter(
                  (_, index) =>
                    data.length <= 45 ||
                    index % 5 === 0 ||
                    index === data.length - 1,
                )
                .map((row) => row.number),
            }}
            animate={animate}
            motionConfig={{ duration: 350 }}
            isFocusable
            barAriaLabel={(bar) =>
              `${bar.data.number}. szám: ${bar.data.count} előfordulás, ${bar.data.occurrence_percentage}%`
            }
            onMouseEnter={(bar) => setHovered(bar.data.number)}
            onMouseLeave={() => setHovered(null)}
            onClick={(bar) => setSelected(bar.data.number)}
            tooltip={({ data: row }) => (
              <div className={styles.tooltip}>
                <strong>{row.number}. szám</strong>
                <br />
                {row.count} előfordulás · {row.occurrence_percentage}%
              </div>
            )}
          />
        </div>
      </div>
      <p className={styles.selection}>
        {active !== null
          ? `${active}. szám: ${data.find((row) => row.number === active)?.count} előfordulás · ${data.find((row) => row.number === active)?.occurrence_percentage}%`
          : 'A százalék nevezője a vizsgált számsorok száma.'}
      </p>
    </div>
  )
}
