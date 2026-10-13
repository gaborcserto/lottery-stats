import { ResponsivePie } from '@nivo/pie'
import { useMemo, useState } from 'react'
import type { ParityData } from '../../api/contracts'
import { getChartTheme } from '../../config/charts'
import { useTheme } from '../ThemeProvider'
import { useChartMotion } from '../ChartSlot'
import styles from './ParityChart.module.scss'

export function ParityChart({ data }: { data: ParityData }) {
  const { resolvedTheme } = useTheme()
  const chartTheme = getChartTheme(resolvedTheme)
  const animate = useChartMotion(resolvedTheme)
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
          margin={{ top: 12, bottom: 12, left: 12, right: 12 }}
          innerRadius={0.64}
          layers={[
            'arcs',
            ({ centerX, centerY }) => (
              <g
                transform={`translate(${centerX}, ${centerY})`}
                aria-hidden="true"
              >
                <text
                  textAnchor="middle"
                  fill="var(--heading)"
                  fontSize="20"
                  fontWeight="750"
                >
                  {data.number_occurrence_count.toLocaleString('hu-HU')}
                </text>
                <text
                  y="20"
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize="11"
                >
                  számelőfordulás
                </text>
              </g>
            ),
          ]}
          padAngle={0}
          cornerRadius={4}
          activeOuterRadiusOffset={6}
          colors={['var(--chart-primary)', 'var(--chart-secondary)']}
          enableArcLinkLabels={false}
          arcLabel={(row) => `${row.id}`}
          enableArcLabels={false}
          animate={animate}
          motionConfig={{ duration: 350 }}
          activeId={hovered ?? selected}
          onActiveIdChange={(id) => setHovered(id === null ? null : String(id))}
          onClick={(row) =>
            setSelected((current) =>
              current === String(row.id) ? null : String(row.id),
            )
          }
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
            onClick={() =>
              setSelected((current) => (current === row.id ? null : row.id))
            }
          >
            {row.id}: {row.value} · {row.percentage}%
          </button>
        ))}
      </div>
    </div>
  )
}
