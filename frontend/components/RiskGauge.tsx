type Risk = 'critical' | 'high' | 'medium' | 'low' | null

const GAUGE_CONFIG: Record<NonNullable<Risk>, { color: string; fill: number; label: string }> = {
  critical: { color: '#DC2626', fill: 1.0, label: 'Critical Risk' },
  high: { color: '#EA580C', fill: 0.75, label: 'High Risk' },
  medium: { color: '#CA8A04', fill: 0.5, label: 'Medium Risk' },
  low: { color: '#16A34A', fill: 0.25, label: 'Low Risk' },
}

const DEFAULT_CONFIG = { color: '#9CA3AF', fill: 0, label: 'Analyzing...' }

export function RiskGauge({ risk }: { risk: Risk }) {
  const config = risk ? GAUGE_CONFIG[risk] : DEFAULT_CONFIG

  // Semicircle arc: radius=40, center=(50,50), arc goes from 180° to 0°
  const r = 40
  const cx = 50
  const cy = 55
  const circumference = Math.PI * r // half circle
  const strokeDasharray = circumference
  const strokeDashoffset = circumference * (1 - config.fill)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 60" className="w-40 h-24">
        {/* Background track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={config.color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r="3" fill={config.color} />
      </svg>
      <span className="text-sm font-semibold mt-1" style={{ color: config.color }}>
        {config.label}
      </span>
    </div>
  )
}
