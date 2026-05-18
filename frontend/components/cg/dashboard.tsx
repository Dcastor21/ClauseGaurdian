'use client'

// components/cg/dashboard.tsx — triage-first dashboard, contract garden below.
import * as React from 'react'
import { Icon } from './icons'
import { TopBar } from './topbar'
import {
  Avatar,
  Btn,
  Leaf,
  LifecycleChip,
  RiskChip,
  SectionLabel,
  StatusChip,
  VerdictPill,
  VERDICT_STYLE,
} from './primitives'
import {
  daysUntil,
  formatDate,
  relativeTime,
  type CgContract,
  type CgNotification,
  type Severity,
} from '@/lib/cg/data'

interface DashProps {
  contracts: CgContract[]
  query: string
  setQuery: (v: string) => void
  riskFilter: string
  setRiskFilter: (v: string) => void
  view: 'list' | 'grid'
  setView: (v: 'list' | 'grid') => void
  onOpen: (id: string) => void
  onUpload: () => void
  onOpenPalette: () => void
  onLoadSamples: () => void
  notifications: CgNotification[]
  onMarkRead: (id: string) => void
}

export function Dashboard({
  contracts,
  query,
  setQuery,
  riskFilter,
  setRiskFilter,
  view,
  setView,
  onOpen,
  onUpload,
  onOpenPalette,
  onLoadSamples,
  notifications,
  onMarkRead,
}: DashProps) {
  if (contracts.length === 0) {
    return (
      <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
        <TopBar
          onUpload={onUpload}
          onOpenPalette={onOpenPalette}
          hideSearch
          currentRoute="dashboard"
          notifications={notifications}
          onMarkRead={onMarkRead}
        />
        <DashboardZeroState onUpload={onUpload} onLoadSamples={onLoadSamples} />
      </div>
    )
  }

  const needsAction = contracts.filter(
    (c) => c.status === 'complete' && (c.verdict === 'negotiate' || c.verdict === 'decline'),
  )
  const failed = contracts.filter((c) => c.status === 'failed')
  const analyzing = contracts.filter(
    (c) => c.status === 'analyzing' || c.status === 'processing',
  )
  const upcomingDeadlines = contracts
    .flatMap((c) => (c.deadlines ?? []).map((d) => ({ ...d, contract: c })))
    .filter((d) => {
      const days = daysUntil(d.date)
      return days != null && days >= 0 && days <= 60
    })
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))

  const filtered = contracts.filter((c) => {
    if (riskFilter !== 'all' && c.risk !== riskFilter) return false
    if (
      query &&
      !c.name.toLowerCase().includes(query.toLowerCase()) &&
      !(c.counterparty ?? '').toLowerCase().includes(query.toLowerCase())
    )
      return false
    return true
  })

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
      <TopBar
        onUpload={onUpload}
        onOpenPalette={onOpenPalette}
        currentRoute="dashboard"
        notifications={notifications}
        onMarkRead={onMarkRead}
      />

      <main
        className="max-w-[1200px] mx-auto px-6 md:px-10 pb-24 pt-8 relative"
        style={{ zIndex: 1 }}
      >
        <Greeting count={contracts.length} />

        <section aria-label="Today's tending" className="mt-6">
          <SectionLabel
            kicker="Today's tending"
            subtitle={new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          />
          <div className="mt-4 grid grid-cols-12 gap-3 md:gap-4">
            <PrimaryTriage contracts={needsAction} onOpen={onOpen} />
            <div className="col-span-12 md:col-span-5 grid grid-cols-1 gap-3 md:gap-4">
              <DeadlineCard items={upcomingDeadlines} onOpen={onOpen} />
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <AnalyzingCard items={analyzing} />
                <FailedCard items={failed} onOpen={onOpen} />
              </div>
            </div>
          </div>
        </section>

        <section aria-label="All contracts" className="mt-12">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <SectionLabel kicker="The garden" subtitle="All contracts you've planted here" />
            <div className="flex items-center gap-2">
              <RiskFilterRow value={riskFilter} onChange={setRiskFilter} />
              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>

          <div className="mt-4">
            {filtered.length === 0 ? (
              <EmptyResults
                onClear={() => {
                  setQuery('')
                  setRiskFilter('all')
                }}
                hasFilters={!!query || riskFilter !== 'all'}
                onUpload={onUpload}
              />
            ) : view === 'list' ? (
              <ContractList contracts={filtered} onOpen={onOpen} />
            ) : (
              <ContractGrid contracts={filtered} onOpen={onOpen} />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function Greeting({ count }: { count: number }) {
  const hour = new Date().getHours()
  const greeting =
    hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="anim-fade-up">
      <p
        className="text-[11px] uppercase tracking-[0.16em] font-medium"
        style={{ color: 'var(--ink-3)' }}
      >
        {greeting}
      </p>
      <h1
        className="font-display mt-1.5 text-[44px] md:text-[56px] leading-[1.12]"
        style={{ color: 'var(--ink)' }}
      >
        You&apos;re tending <em>{count}</em> contract{count === 1 ? '' : 's'}.
      </h1>
    </div>
  )
}

function PrimaryTriage({
  contracts,
  onOpen,
}: {
  contracts: CgContract[]
  onOpen: (id: string) => void
}) {
  const first = contracts[0]
  if (!first) {
    return (
      <div
        className="col-span-12 md:col-span-7 rounded-2xl p-7 flex flex-col anim-fade-up"
        style={{
          background: 'var(--low-bg)',
          border: '1px solid color-mix(in oklch, var(--low) 25%, transparent)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="grid place-items-center w-7 h-7 rounded-full"
            style={{ background: 'var(--low)', color: 'white' }}
          >
            <Icon.Check size={14} />
          </span>
          <span
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--low)' }}
          >
            All clear
          </span>
        </div>
        <h3
          className="font-display mt-3 text-[34px] leading-[1.18]"
          style={{ color: 'var(--ink)' }}
        >
          Nothing needs your eyes right now.
        </h3>
        <p className="text-sm mt-2 max-w-md" style={{ color: 'var(--ink-2)' }}>
          Every contract you&apos;ve planted is either signed-and-safe or still being read. Take the
          afternoon off.
        </p>
      </div>
    )
  }

  const v = VERDICT_STYLE[first.verdict!]
  const others = contracts.slice(1)

  return (
    <div
      className="col-span-12 md:col-span-7 rounded-2xl overflow-hidden anim-fade-up cursor-pointer group transition"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-md)',
      }}
      onClick={() => onOpen(first.id)}
    >
      <div className="p-6 md:p-7 flex flex-col h-full">
        <div className="flex items-center gap-2">
          <span
            className="grid place-items-center w-7 h-7 rounded-full"
            style={{ background: v.bg, color: v.fg }}
          >
            <Icon.AlertTriangle size={13} />
          </span>
          <span
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: v.fg }}
          >
            Needs your attention
          </span>
        </div>

        <h3
          className="font-display mt-3 text-[28px] md:text-[34px] leading-[1.18]"
          style={{ color: 'var(--ink)' }}
        >
          <em>{first.counterparty}</em> wants you to sign their{' '}
          <span style={{ color: 'var(--ink-2)' }}>{(first.kind ?? 'contract').toLowerCase()}</span>.
          We&apos;d push back on it first.
        </h3>

        <p
          className="text-[15px] leading-relaxed mt-5 max-w-2xl"
          style={{ color: 'var(--ink-2)' }}
        >
          {first.verdictNote}
        </p>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <VerdictPill verdict={first.verdict} size="lg" />
          <span className="text-sm" style={{ color: 'var(--ink-3)' }}>
            {first.clauses.filter((c) => c.severity === 'critical').length} critical ·{' '}
            {first.clauses.filter((c) => c.severity === 'high').length} high
          </span>
        </div>

        <div
          className="mt-auto pt-6 flex items-center justify-between border-t"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={first.counterparty} size={28} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                {first.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                {first.pages > 0 && <span className="font-mono">p.{first.pages} · </span>}uploaded{' '}
                {relativeTime(first.uploadedAt)}
              </p>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1 text-sm font-medium transition group-hover:gap-2"
            style={{ color: 'var(--primary)' }}
          >
            Review now <Icon.ArrowRight size={14} />
          </span>
        </div>

        {others.length > 0 && (
          <p
            className="text-xs mt-4 pt-4 border-t"
            style={{ color: 'var(--ink-3)', borderColor: 'var(--line-2)' }}
          >
            {others.length} other contract{others.length === 1 ? '' : 's'} also need
            {others.length === 1 ? 's' : ''} attention
          </p>
        )}
      </div>
    </div>
  )
}

function DeadlineCard({
  items,
  onOpen,
}: {
  items: (CgContract['deadlines'][number] & { contract: CgContract })[]
  onOpen: (id: string) => void
}) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col gap-1 anim-fade-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <div className="flex items-center gap-2">
          <Icon.Calendar size={14} style={{ color: 'var(--ink-3)' }} />
          <span
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--ink-3)' }}
          >
            Calendar
          </span>
        </div>
        <p className="text-sm mt-2" style={{ color: 'var(--ink-2)' }}>
          No deadlines coming up.
        </p>
      </div>
    )
  }
  return (
    <div
      className="rounded-2xl p-5 anim-fade-up"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon.Calendar size={14} style={{ color: 'var(--ink-3)' }} />
          <span
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--ink-3)' }}
          >
            Coming up
          </span>
        </div>
        <span className="text-[11px] font-mono" style={{ color: 'var(--ink-3)' }}>
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="space-y-2.5">
        {items.slice(0, 3).map((d) => {
          const days = daysUntil(d.date)!
          const urgent = days <= 14
          return (
            <li
              key={d.id}
              className="flex items-start gap-3 group cursor-pointer"
              onClick={() => onOpen(d.contract.id)}
            >
              <div className="shrink-0 w-12 text-center pt-0.5">
                <div
                  className="font-display text-[26px] leading-none"
                  style={{ color: urgent ? `var(--${d.urgency})` : 'var(--ink)' }}
                >
                  {days}
                </div>
                <div
                  className="text-[10px] uppercase tracking-wide font-mono mt-0.5"
                  style={{ color: 'var(--ink-3)' }}
                >
                  days
                </div>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className="text-[13px] leading-snug font-medium"
                  style={{ color: 'var(--ink)' }}
                >
                  {d.label}
                </p>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>
                  {d.contract.counterparty}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AnalyzingCard({ items }: { items: CgContract[] }) {
  return (
    <div
      className="rounded-2xl p-5 anim-fade-up flex flex-col gap-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-center gap-2">
        <span className="relative grid place-items-center w-5 h-5">
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: 'var(--accent-2)', animation: 'shimmer 2s linear infinite' }}
          />
          <Leaf size={11} color="var(--accent)" />
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.16em] font-medium"
          style={{ color: 'var(--ink-3)' }}
        >
          Still reading
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
          Nothing in progress.
        </p>
      ) : (
        <div>
          <p className="font-display text-[26px] leading-none" style={{ color: 'var(--ink)' }}>
            {items.length}
          </p>
          <p className="text-[12px] mt-1 truncate" style={{ color: 'var(--ink-3)' }}>
            {items[0].name}
          </p>
          {items.length > 1 && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              + {items.length - 1} more
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function FailedCard({
  items,
  onOpen,
}: {
  items: CgContract[]
  onOpen: (id: string) => void
}) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col gap-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <div className="flex items-center gap-2">
          <Icon.Check size={14} style={{ color: 'var(--low)' }} />
          <span
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--ink-3)' }}
          >
            All readable
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
          No errors.
        </p>
      </div>
    )
  }
  return (
    <button
      onClick={() => onOpen(items[0].id)}
      className="rounded-2xl p-5 flex flex-col gap-3 text-left transition hover:opacity-90"
      style={{
        background: 'var(--critical-bg)',
        border: '1px solid color-mix(in oklch, var(--critical) 25%, transparent)',
      }}
    >
      <div className="flex items-center gap-2">
        <Icon.AlertCircle size={14} style={{ color: 'var(--critical)' }} />
        <span
          className="text-[11px] uppercase tracking-[0.16em] font-medium"
          style={{ color: 'var(--critical)' }}
        >
          Needs help
        </span>
      </div>
      <div>
        <p className="font-display text-[26px] leading-none" style={{ color: 'var(--critical)' }}>
          {items.length}
        </p>
        <p className="text-[12px] mt-1 truncate" style={{ color: 'var(--ink-2)' }}>
          couldn&apos;t be read
        </p>
      </div>
    </button>
  )
}

function RiskFilterRow({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const opts = [
    { key: 'all', label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low', label: 'Low' },
  ]
  return (
    <div
      className="flex p-0.5 rounded-md"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
    >
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="px-2.5 py-1 text-xs font-medium rounded transition"
          style={
            value === o.key
              ? { background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)' }
              : { color: 'var(--ink-3)' }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ViewToggle({
  value,
  onChange,
}: {
  value: 'list' | 'grid'
  onChange: (v: 'list' | 'grid') => void
}) {
  return (
    <div
      className="flex p-0.5 rounded-md"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
    >
      {(
        [
          { key: 'list', icon: Icon.List },
          { key: 'grid', icon: Icon.Grid },
        ] as const
      ).map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          aria-label={`${o.key} view`}
          className="grid place-items-center w-7 h-7 rounded transition"
          style={
            value === o.key
              ? { background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)' }
              : { color: 'var(--ink-3)' }
          }
        >
          <o.icon size={14} />
        </button>
      ))}
    </div>
  )
}

function ContractList({
  contracts,
  onOpen,
}: {
  contracts: CgContract[]
  onOpen: (id: string) => void
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      {contracts.map((c, i) => (
        <ContractRow
          key={c.id}
          contract={c}
          onOpen={onOpen}
          isLast={i === contracts.length - 1}
        />
      ))}
    </div>
  )
}

function ContractRow({
  contract,
  onOpen,
  isLast,
}: {
  contract: CgContract
  onOpen: (id: string) => void
  isLast: boolean
}) {
  const days = daysUntil(contract.expiresAt)
  return (
    <button
      onClick={() => onOpen(contract.id)}
      className="w-full grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-4 text-left transition hover:bg-black/[.02] group"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--line-2)' }}
    >
      <Avatar name={contract.counterparty ?? contract.name} size={36} />
      <div className="min-w-0">
        <p className="text-[14px] font-medium truncate" style={{ color: 'var(--ink)' }}>
          {contract.counterparty ?? 'Unknown counterparty'}
        </p>
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>
          {contract.kind ? `${contract.kind} · ` : ''}
          {contract.name}
        </p>
      </div>
      <div className="hidden md:flex flex-col items-end gap-1">
        {contract.status === 'complete' ? (
          <>
            <VerdictPill verdict={contract.verdict} />
            {contract.lifecycle && contract.lifecycle !== 'reviewing' && (
              <LifecycleChip lifecycle={contract.lifecycle} />
            )}
          </>
        ) : (
          <StatusChip status={contract.status} />
        )}
      </div>
      <div className="hidden md:block w-24 text-right">
        {contract.expiresAt ? (
          <>
            <p
              className="font-mono text-xs"
              style={{ color: days != null && days <= 14 ? 'var(--critical)' : 'var(--ink-2)' }}
            >
              {days != null && days >= 0 ? `in ${days}d` : 'expired'}
            </p>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              {formatDate(contract.expiresAt, { short: true })}
            </p>
          </>
        ) : (
          <p className="font-mono text-xs" style={{ color: 'var(--ink-3)' }}>
            —
          </p>
        )}
      </div>
      <span
        className="opacity-0 group-hover:opacity-100 transition"
        style={{ color: 'var(--ink-3)' }}
      >
        <Icon.ChevronRight size={14} />
      </span>
    </button>
  )
}

function ContractGrid({
  contracts,
  onOpen,
}: {
  contracts: CgContract[]
  onOpen: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {contracts.map((c) => (
        <ContractGridCard key={c.id} contract={c} onOpen={onOpen} />
      ))}
    </div>
  )
}

function ContractGridCard({
  contract,
  onOpen,
}: {
  contract: CgContract
  onOpen: (id: string) => void
}) {
  const days = daysUntil(contract.expiresAt)
  return (
    <button
      onClick={() => onOpen(contract.id)}
      className="rounded-xl p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <Avatar name={contract.counterparty ?? contract.name} size={36} />
        <div className="flex flex-col items-end gap-1">
          {contract.status === 'complete' ? (
            <VerdictPill verdict={contract.verdict} />
          ) : (
            <StatusChip status={contract.status} />
          )}
          {contract.lifecycle &&
            contract.lifecycle !== 'reviewing' &&
            contract.status === 'complete' && <LifecycleChip lifecycle={contract.lifecycle} />}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium leading-snug" style={{ color: 'var(--ink)' }}>
          {contract.counterparty ?? 'Unknown counterparty'}
        </p>
        <p className="text-xs mt-1 leading-snug" style={{ color: 'var(--ink-3)' }}>
          {contract.kind}
        </p>
      </div>
      <p
        className="text-xs leading-relaxed line-clamp-2 min-h-[2.6em]"
        style={{ color: 'var(--ink-2)' }}
      >
        {contract.summary ??
          (contract.status === 'analyzing'
            ? 'Still reading the document…'
            : contract.failReason ?? '')}
      </p>
      <div
        className="mt-auto pt-3 flex items-center justify-between border-t"
        style={{ borderColor: 'var(--line-2)' }}
      >
        <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
          {contract.pages > 0 ? `${contract.pages}p` : '—'}
        </span>
        {contract.expiresAt && (
          <span
            className="font-mono text-[11px]"
            style={{ color: days != null && days <= 14 ? 'var(--critical)' : 'var(--ink-3)' }}
          >
            {days != null && days >= 0 ? `expires in ${days}d` : 'expired'}
          </span>
        )}
      </div>
    </button>
  )
}

function EmptyResults({
  onClear,
  onUpload,
  hasFilters,
}: {
  onClear: () => void
  onUpload: () => void
  hasFilters: boolean
}) {
  if (hasFilters) {
    return (
      <div
        className="rounded-xl p-12 text-center"
        style={{ background: 'var(--surface)', border: '1px dashed var(--line)' }}
      >
        <p
          className="font-display text-[28px] leading-[1.22]"
          style={{ color: 'var(--ink)' }}
        >
          Nothing in this bed of the garden.
        </p>
        <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: 'var(--ink-2)' }}>
          Try clearing your filter, or upload a new contract.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Btn variant="soft" onClick={onClear}>
            Clear filters
          </Btn>
          <Btn variant="primary" icon={Icon.Upload} onClick={onUpload}>
            upload a contract
          </Btn>
        </div>
      </div>
    )
  }
  return null
}

function DashboardZeroState({
  onUpload,
  onLoadSamples,
}: {
  onUpload: () => void
  onLoadSamples: () => void
}) {
  const [drag, setDrag] = React.useState(false)

  return (
    <main
      className="max-w-[1100px] mx-auto px-6 md:px-10 pb-24 pt-12 md:pt-20 relative"
      style={{ zIndex: 1 }}
    >
      <div className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-12 lg:col-span-7 anim-fade-up">
          <p
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--ink-3)' }}
          >
            Welcome to ClauseGuardian
          </p>
          <h1
            className="font-display mt-3 text-[48px] md:text-[64px] leading-[1.08]"
            style={{ color: 'var(--ink)' }}
          >
            Drop a contract.
            <br />
            <em style={{ color: 'var(--primary)' }}>We&apos;ll tend to it.</em>
          </h1>
          <p
            className="text-[17px] leading-[1.6] mt-6 max-w-xl"
            style={{ color: 'var(--ink-2)' }}
          >
            We read every page, flag the clauses that could quietly hurt you, and explain them in
            plain English.
            <br />
            No legalese. No 50-tab cross-references. Just what to sign, what to push back on, and
            what to do next.
          </p>

          <div className="mt-9 flex items-center gap-2">
            <Btn variant="primary" size="lg" icon={Icon.Upload} onClick={onUpload}>
              Plant your first contract
            </Btn>
            <span
              className="text-xs ml-2 flex items-center gap-1.5"
              style={{ color: 'var(--ink-3)' }}
            >
              <Icon.FileText size={12} /> PDF or DOCX, up to 20 MB
            </span>
          </div>

          <ul className="mt-10 space-y-3.5">
            {[
              {
                icon: Icon.Search,
                title: 'We spot the buried clauses',
                sub: 'Auto-renewal, indemnification, liability caps — the stuff that hides on page 11.',
              },
              {
                icon: Icon.Lightbulb,
                title: 'We explain it in plain English',
                sub: 'No "hereinafter" or "force majeure." Just what it means for your business.',
              },
              {
                icon: Icon.Send,
                title: 'We draft what you should push back on',
                sub: "Suggested redlines and a ready-to-send email. You don't have to be a lawyer.",
              },
            ].map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-3.5 anim-fade-up"
                style={{ animationDelay: `${0.1 + i * 0.08}s`, animationFillMode: 'both' }}
              >
                <span
                  className="grid place-items-center w-8 h-8 rounded-md shrink-0 mt-0.5"
                  style={{ background: 'var(--primary-2)', color: 'var(--primary)' }}
                >
                  <item.icon size={14} />
                </span>
                <div>
                  <p
                    className="text-[14px] font-medium leading-snug"
                    style={{ color: 'var(--ink)' }}
                  >
                    {item.title}
                  </p>
                  <p className="text-[13px] leading-snug mt-0.5" style={{ color: 'var(--ink-3)' }}>
                    {item.sub}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              onUpload()
            }}
            onClick={onUpload}
            className="cursor-pointer block rounded-2xl p-7 md:p-10 relative overflow-hidden transition anim-fade-up"
            style={{
              animationDelay: '0.15s',
              animationFillMode: 'both',
              background: drag ? 'var(--primary-2)' : 'var(--surface)',
              border: `1.5px dashed ${drag ? 'var(--primary)' : 'var(--line)'}`,
            }}
          >
            <div className="relative h-[220px] mb-4 mx-auto" style={{ maxWidth: 200 }}>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={`mote-${i}`}
                  className="absolute w-1 h-1 rounded-full pointer-events-none"
                  style={{
                    background: 'var(--primary)',
                    left: `${20 + i * 22}%`,
                    bottom: '20%',
                    opacity: 0,
                    animation: `float-mote ${3 + i * 0.8}s ease-in-out ${i * 0.7}s infinite`,
                  }}
                />
              ))}
              {[2, 1, 0].map((i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-md"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    boxShadow: i === 0 ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    animation: `paper-breathe-${i + 1} ${5 + i * 0.4}s ease-in-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                    zIndex: 3 - i,
                    opacity: 1 - i * 0.12,
                  }}
                >
                  <div className="p-4 space-y-1.5">
                    {[0, 1, 2, 3, 4, 5].map((li) => (
                      <div
                        key={li}
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${50 + ((li * 37 + i * 11) % 50)}%`,
                          background: 'var(--line)',
                        }}
                      />
                    ))}
                    <div
                      className="mt-3 h-1.5 rounded-full"
                      style={{ width: '70%', background: 'var(--line)' }}
                    />
                    {[0, 1, 2].map((li) => (
                      <div
                        key={li}
                        className="h-1.5 rounded-full"
                        style={{ width: `${40 + ((li * 31) % 50)}%`, background: 'var(--line)' }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <span
                className="absolute -top-2 -right-2 grid place-items-center w-10 h-10 rounded-full"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  boxShadow: '0 6px 18px color-mix(in oklch, var(--primary) 40%, transparent)',
                  animation: drag ? 'none' : 'leaf-hover 4s ease-in-out infinite',
                  transform: drag ? 'scale(1.08) rotate(8deg)' : undefined,
                  transition: 'transform .3s',
                }}
              >
                <Leaf size={18} />
              </span>
            </div>

            <p
              className="text-sm text-center"
              style={{ color: drag ? 'var(--primary)' : 'var(--ink-2)' }}
            >
              {drag ? (
                'Drop it!'
              ) : (
                <>
                  Drag a contract here, or{' '}
                  <span style={{ color: 'var(--primary)', fontWeight: 500 }}>browse files</span>.
                </>
              )}
            </p>
            <p
              className="text-xs text-center mt-1.5 font-mono"
              style={{ color: 'var(--ink-3)' }}
            >
              PDF · DOCX · up to 20 MB
            </p>
          </label>

          <div
            className="mt-4 rounded-xl p-4 flex items-start gap-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
          >
            <Icon.Sparkle size={14} className="shrink-0 mt-1" style={{ color: 'var(--accent)' }} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                Just kicking the tires?
              </p>
              <p className="text-[12px] leading-snug mt-0.5" style={{ color: 'var(--ink-3)' }}>
                Load a sample SaaS agreement and office lease so you can see how it works.
              </p>
            </div>
            <Btn variant="soft" size="sm" onClick={onLoadSamples}>
              Load samples
            </Btn>
          </div>
        </div>
      </div>

      <section
        className="mt-20 anim-fade-up"
        style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
      >
        <p
          className="text-[11px] uppercase tracking-[0.16em] font-medium"
          style={{ color: 'var(--ink-3)' }}
        >
          What we look for
        </p>
        <p className="font-display mt-1.5 text-[24px]" style={{ color: 'var(--ink)' }}>
          The clauses small businesses miss most.
        </p>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              {
                sev: 'critical',
                label: 'Auto-renewal traps',
                sub: 'Locks you in for another year if you forget to cancel',
              },
              {
                sev: 'critical',
                label: 'Tiny liability caps',
                sub: 'Their max payout if they hurt your business is one month of fees',
              },
              {
                sev: 'high',
                label: 'One-sided indemnification',
                sub: "You cover their lawyer bills; they don't cover yours",
              },
              {
                sev: 'high',
                label: 'Unilateral termination',
                sub: 'They can leave instantly; you owe 30+ days',
              },
              {
                sev: 'medium',
                label: 'Uncapped CAM charges',
                sub: 'Hidden operating-expense passthroughs in leases',
              },
              {
                sev: 'medium',
                label: 'IP ownership ambiguity',
                sub: 'Who actually owns the work product',
              },
              {
                sev: 'low',
                label: 'Payment terms',
                sub: 'Net 15 vs. Net 30, late fees, invoice cycles',
              },
              {
                sev: 'low',
                label: 'Confidentiality scope',
                sub: "What's protected, for how long, and who's covered",
              },
            ] as { sev: Severity; label: string; sub: string }[]
          ).map((it, i) => (
            <div
              key={i}
              className="rounded-lg p-3.5 flex flex-col gap-1.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <RiskChip risk={it.sev} />
              <p
                className="text-[13px] font-medium leading-snug mt-1"
                style={{ color: 'var(--ink)' }}
              >
                {it.label}
              </p>
              <p className="text-[11.5px] leading-snug" style={{ color: 'var(--ink-3)' }}>
                {it.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center mt-16 text-[12px]" style={{ color: 'var(--ink-3)' }}>
        ClauseGuardian summarizes contracts — but it isn&apos;t your lawyer. For anything important,
        share with a real attorney before signing.
      </p>
    </main>
  )
}
