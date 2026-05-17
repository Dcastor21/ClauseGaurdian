// components/cg/primitives.tsx — small shared components.
import * as React from 'react'
import { Icon, type IconName } from './icons'
import type { Severity, Verdict, Lifecycle } from '@/lib/cg/data'

export const SEV_COLOR: Record<Severity, { fg: string; bg: string; label: string }> = {
  critical: { fg: 'var(--critical)', bg: 'var(--critical-bg)', label: 'Critical' },
  high: { fg: 'var(--high)', bg: 'var(--high-bg)', label: 'High' },
  medium: { fg: 'var(--medium)', bg: 'var(--medium-bg)', label: 'Medium' },
  low: { fg: 'var(--low)', bg: 'var(--low-bg)', label: 'Low' },
}

export function RiskChip({
  risk,
  size = 'sm',
  showDot = true,
  className = '',
}: {
  risk?: Severity | null
  size?: 'sm' | 'lg'
  showDot?: boolean
  className?: string
}) {
  if (!risk) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}
        style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}
      >
        {showDot && (
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ink-3)' }} />
        )}
        Pending
      </span>
    )
  }
  const c = SEV_COLOR[risk]
  const padding = size === 'lg' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${padding} ${className}`}
      style={{ background: c.bg, color: c.fg }}
    >
      {showDot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.fg }} />}
      {c.label}
    </span>
  )
}

export const VERDICT_STYLE: Record<
  Verdict,
  { label: string; fg: string; bg: string; icon: IconName }
> = {
  sign: { label: 'Safe to sign', fg: 'var(--low)', bg: 'var(--low-bg)', icon: 'Check' },
  'sign-with-edits': {
    label: 'Sign with edits',
    fg: 'var(--medium)',
    bg: 'var(--medium-bg)',
    icon: 'Pen',
  },
  negotiate: {
    label: 'Negotiate before signing',
    fg: 'var(--high)',
    bg: 'var(--high-bg)',
    icon: 'AlertTriangle',
  },
  decline: {
    label: "Don't sign yet",
    fg: 'var(--critical)',
    bg: 'var(--critical-bg)',
    icon: 'AlertCircle',
  },
}

export function VerdictPill({
  verdict,
  size = 'md',
}: {
  verdict?: Verdict | null
  size?: 'md' | 'lg'
}) {
  if (!verdict) return null
  const v = VERDICT_STYLE[verdict]
  const IconCmp = Icon[v.icon]
  const padding = size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${padding}`}
      style={{ background: v.bg, color: v.fg }}
    >
      <IconCmp size={size === 'lg' ? 14 : 12} />
      {v.label}
    </span>
  )
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; fg: string; bg: string }> = {
    complete: { label: 'Tended', fg: 'var(--low)', bg: 'var(--low-bg)' },
    analyzing: { label: 'Reading…', fg: 'var(--accent)', bg: 'var(--accent-2)' },
    processing: { label: 'Queued', fg: 'var(--ink-2)', bg: 'var(--surface-2)' },
    failed: { label: 'Needs help', fg: 'var(--critical)', bg: 'var(--critical-bg)' },
  }
  const c = map[status] ?? map.processing
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.fg }} />
      {c.label}
    </span>
  )
}

export function RiskGauge({ risk, size = 168 }: { risk?: Severity | null; size?: number }) {
  const FILL: Record<Severity, number> = { critical: 0.95, high: 0.72, medium: 0.48, low: 0.22 }
  const r = 70,
    cx = 90,
    cy = 92
  const fill = risk ? FILL[risk] : 0
  const color = risk ? `var(--${risk})` : 'var(--ink-3)'
  const circ = Math.PI * r

  const ticks = Array.from({ length: 16 }).map((_, i) => {
    const t = i / 15
    const angle = Math.PI - t * Math.PI
    const x1 = cx + Math.cos(angle) * (r - 3)
    const y1 = cy - Math.sin(angle) * (r - 3)
    const x2 = cx + Math.cos(angle) * (r + 3)
    const y2 = cy - Math.sin(angle) * (r + 3)
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line)" strokeWidth="1" />
  })

  const needleAngle = Math.PI - fill * Math.PI
  const nx = cx + Math.cos(needleAngle) * (r - 12)
  const ny = cy - Math.sin(needleAngle) * (r - 12)

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size }}>
      <svg
        viewBox="0 0 180 110"
        width={size}
        height={size * 0.65}
        role="img"
        aria-label={`Risk: ${risk ?? 'pending'}`}
      >
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--line)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - fill)}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1), stroke .3s' }}
        />
        {ticks}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transition: 'all .8s cubic-bezier(.2,.7,.2,1)' }}
        />
        <circle cx={cx} cy={cy} r="4" fill={color} />
        <text
          x={cx - r}
          y={cy + 18}
          fontSize="9"
          fill="var(--ink-3)"
          fontFamily="Geist Mono"
          textAnchor="middle"
        >
          low
        </text>
        <text
          x={cx + r}
          y={cy + 18}
          fontSize="9"
          fill="var(--ink-3)"
          fontFamily="Geist Mono"
          textAnchor="middle"
        >
          critical
        </text>
      </svg>
    </div>
  )
}

export function RiskBar({
  critical = 0,
  high = 0,
  medium = 0,
  low = 0,
  total,
}: {
  critical?: number
  high?: number
  medium?: number
  low?: number
  total?: number
}) {
  const t = (total ?? critical + high + medium + low) || 1
  const seg = (n: number, color: string) =>
    n > 0 && (
      <div
        style={{ width: `${(n / t) * 100}%`, background: color }}
        className="h-full first:rounded-l-full last:rounded-r-full"
      />
    )
  return (
    <div
      className="flex h-1.5 rounded-full overflow-hidden"
      style={{ background: 'var(--line-2)' }}
    >
      {seg(critical, 'var(--critical)')}
      {seg(high, 'var(--high)')}
      {seg(medium, 'var(--medium)')}
      {seg(low, 'var(--low)')}
    </div>
  )
}

type BtnVariant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger'

export function Btn({
  children,
  variant = 'ghost',
  size = 'md',
  icon: IconCmp,
  onClick,
  disabled,
  type = 'button',
  className = '',
  style,
}: {
  children?: React.ReactNode
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ComponentType<{ size?: number }>
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  style?: React.CSSProperties
}) {
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3 py-2 text-sm', lg: 'px-4 py-2.5 text-sm' }
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: 'var(--primary)', color: 'white', borderColor: 'transparent' },
    soft: { background: 'var(--surface-2)', color: 'var(--ink)', borderColor: 'var(--line)' },
    ghost: { background: 'transparent', color: 'var(--ink-2)', borderColor: 'transparent' },
    outline: { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)' },
    danger: { background: 'var(--critical-bg)', color: 'var(--critical)', borderColor: 'transparent' },
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md font-medium transition disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[.98] border ${sizes[size]} ${className}`}
      style={{ ...variants[variant], ...style }}
    >
      {IconCmp && <IconCmp size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
}

export function Avatar({ name, size = 28 }: { name?: string | null; size?: number }) {
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
  let h = 0
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const hue = h % 360
  return (
    <div
      className="rounded-md flex items-center justify-center shrink-0 font-medium font-mono"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `oklch(0.92 0.04 ${hue})`,
        color: `oklch(0.35 0.08 ${hue})`,
      }}
    >
      {initials}
    </div>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="font-mono inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
    >
      {children}
    </kbd>
  )
}

export function Leaf({ size = 18, color }: { size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 20A7 7 0 014 13c0-6 7-9 16-9 0 9-3 16-9 16z" />
      <path d="M4 21c2-4 4-6 8-8" />
    </svg>
  )
}

export const LIFECYCLE_STYLE: Record<Lifecycle, { label: string; fg: string; bg: string }> = {
  draft: { label: 'Draft', fg: 'var(--ink-2)', bg: 'var(--surface-2)' },
  reviewing: { label: 'Reviewing', fg: 'var(--accent)', bg: 'var(--accent-2)' },
  negotiating: { label: 'Negotiating', fg: 'var(--high)', bg: 'var(--high-bg)' },
  signed: { label: 'Signed', fg: 'var(--primary)', bg: 'var(--primary-2)' },
  active: { label: 'Active', fg: 'var(--low)', bg: 'var(--low-bg)' },
  archived: { label: 'Archived', fg: 'var(--ink-3)', bg: 'var(--surface-2)' },
}

export function LifecycleChip({
  lifecycle,
  size = 'sm',
}: {
  lifecycle?: Lifecycle | null
  size?: 'sm' | 'lg'
}) {
  const c = lifecycle ? LIFECYCLE_STYLE[lifecycle] : null
  if (!c) return null
  const padding = size === 'lg' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${padding}`}
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.fg }} />
      {c.label}
    </span>
  )
}

export function SectionLabel({
  kicker,
  subtitle,
}: {
  kicker: string
  subtitle?: string
}) {
  return (
    <div>
      <p
        className="text-[11px] uppercase tracking-[0.16em] font-medium"
        style={{ color: 'var(--ink-3)' }}
      >
        {kicker}
      </p>
      {subtitle && (
        <p
          className="font-display text-[22px] mt-0.5 leading-tight"
          style={{ color: 'var(--ink)' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
