import { clsx } from 'clsx'

type Risk = 'critical' | 'high' | 'medium' | 'low' | null

const RISK_STYLES: Record<NonNullable<Risk>, string> = {
  critical: 'bg-red-100 text-red-700 border border-red-200',
  high: 'bg-orange-100 text-orange-700 border border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  low: 'bg-green-100 text-green-700 border border-green-200',
}

const RISK_LABELS: Record<NonNullable<Risk>, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function RiskBadge({ risk, className }: { risk: Risk; className?: string }) {
  if (!risk) {
    return (
      <span className={clsx('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200', className)}>
        Unknown
      </span>
    )
  }
  return (
    <span className={clsx('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', RISK_STYLES[risk], className)}>
      {RISK_LABELS[risk]}
    </span>
  )
}
