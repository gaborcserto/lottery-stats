import { chartTheme } from '../../config/charts'
import { ResponsiveBar } from '@nivo/bar'
import { useState } from 'react'
import type { GamePageData } from '../../api/page-data'
import styles from './NumberPairsChart.module.scss'

export function NumberPairsChart({
  data,
}: {
  data: NonNullable<GamePageData['pairs']>['data']
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const rows = data.map((row) => ({
    ...row,
    pair: `${row.first_number} + ${row.second_number}`,
  }))
  const selectedPair = rows.some((row) => row.pair === selected)
    ? selected
    : null
  const active = hovered ?? selectedPair
  const selection = rows.find((row) => row.pair === active)
  return (
    <div className={styles.chart}>
      <label className={styles.selection}>
        Kiemelt pár{' '}
        <select
          value={selectedPair ?? ''}
          onChange={(event) => setSelected(event.currentTarget.value || null)}
        >
          <option value="">Összes pár</option>
          {rows.map((row) => (
            <option key={row.pair} value={row.pair}>
              {row.pair}
            </option>
          ))}
        </select>
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
            active === null || active === bar.data.pair ? '#176039' : '#97b5a4'
          }
          borderRadius={3}
          enableLabel={false}
          animate={false}
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
