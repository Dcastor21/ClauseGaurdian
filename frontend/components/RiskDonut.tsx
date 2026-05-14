'use client'

import { PieChart, Pie, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

type Severity = 'critical' | 'high' | 'medium' | 'low'

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#CA8A04',
  low: '#16A34A',
}

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

const CHART_CONFIG: ChartConfig = {
  critical: { label: 'Critical', color: '#DC2626' },
  high:     { label: 'High',     color: '#EA580C' },
  medium:   { label: 'Medium',   color: '#CA8A04' },
  low:      { label: 'Low',      color: '#16A34A' },
}

export function RiskDonut({ clauses }: { clauses: { severity: Severity }[] }) {
  const counts = clauses.reduce<Record<Severity, number>>(
    (acc, c) => { acc[c.severity] = (acc[c.severity] ?? 0) + 1; return acc },
    { critical: 0, high: 0, medium: 0, low: 0 },
  )

  const data = SEVERITIES
    .filter(s => counts[s] > 0)
    .map(s => ({ name: s, label: SEVERITY_LABELS[s], value: counts[s], fill: SEVERITY_COLORS[s] }))

  if (data.length === 0) return null

  return (
    <ChartContainer config={CHART_CONFIG} className="mx-auto h-[120px] w-[120px]">
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent nameKey="label" hideLabel indicator="dot" />}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={35}
          outerRadius={52}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map(entry => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
