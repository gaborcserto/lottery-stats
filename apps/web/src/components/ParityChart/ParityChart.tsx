import { ResponsivePie } from '@nivo/pie'
import { useMemo, useState } from 'react'
import type { GamePageData } from '../../api/page-data'
import { getChartTheme } from '../../config/charts'
import { useTheme } from '../ThemeProvider'
import styles from './ParityChart.module.scss'

export function ParityChart({
  data,
}: {
  data: GamePageData['parity']['data']
}) {
  const { resolvedTheme } = useTheme()
  const chartTheme = getChartTheme(resolvedTheme)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const rows = useMemo(
    () => [
      {
        id: 'Páros',
        value: data.even.count,
        percentage: data.even.occurrence_share_percentage,
      },
      {
        id: 'Páratlan',
        value: data.odd.count,
        percentage: data.odd.occurrence_share_percentage,
      },
    ],
    [data],
  )
  if (!data.number_occurrence_count)
    return <p>Nincs számelőfordulás ebben az időszakban.</p>
  return (
    <div className={styles.chart}>
      <div className={styles.canvas}>
        <ResponsivePie
          theme={chartTheme}
          data={rows}
          margin={{ top: 24, bottom: 24, left: 24, right: 24 }}
          innerRadius={0.64}
          padAngle={2}
          cornerRadius={4}
          activeOuterRadiusOffset={6}
          colors={['var(--chart-primary)', 'var(--chart-secondary)']}
          enableArcLinkLabels={false}
          arcLabel={(row) => `${row.id}`}
          enableArcLabels={false}
          animate={false}
          activeId={hovered ?? selected}
          onActiveIdChange={(id) => setHovered(id === null ? null : String(id))}
          onClick={(row) => setSelected(String(row.id))}
          tooltip={({ datum }) => (
            <div className={styles.tooltip}>
              {datum.id}: {datum.value} előfordulás · {datum.data.percentage}%
            </div>
          )}
        />
      </div>
      <div className={styles.legend}>
        {rows.map((row) => (
          <button
            key={row.id}
            aria-pressed={selected === row.id}
            onFocus={() => setSelected(row.id)}
            onClick={() => setSelected(row.id)}
          >
            {row.id}: {row.value} · {row.percentage}%
          </button>
        ))}
      </div>
    </div>
  )
}
