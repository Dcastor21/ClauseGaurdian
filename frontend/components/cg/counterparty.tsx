'use client'

// components/cg/counterparty.tsx — counterparty profile: past contracts, tendencies.
import * as React from 'react'
import { PageShell, type ChromeProps } from './topbar'
import { Avatar, LifecycleChip, SectionLabel } from './primitives'
import { KPI, estimateExposure } from './analytics'
import {
  formatDate,
  relativeTime,
  type CgContract,
  type Lifecycle,
  type Severity,
} from '@/lib/cg/data'

interface HistoricalRow {
  id: string
  kind: string
  lifecycle: Lifecycle
  historical: true
  name: string
  clauses: never[]
  deadlines: never[]
  uploadedAt: string
  signedAt: string
  expiresAt: string
  risk: Severity
  exposure: number
}

function FAKE_HISTORICAL_FOR(name: string): HistoricalRow[] {
  if (name.toLowerCase().includes('acme')) {
    return [
      {
        id: 'fake-acme-1',
        kind: 'SaaS Subscription',
        lifecycle: 'archived',
        historical: true,
        name: 'Master Services Agreement — 2024',
        clauses: [],
        deadlines: [],
        uploadedAt: '2024-04-12T00:00:00Z',
        signedAt: '2024-04-15',
        expiresAt: '2025-04-15',
        risk: 'medium',
        exposure: 9600,
      },
      {
        id: 'fake-acme-2',
        kind: 'SaaS Subscription',
        lifecycle: 'archived',
        historical: true,
        name: 'Renewal Amendment — 2025',
        clauses: [],
        deadlines: [],
        uploadedAt: '2025-04-08T00:00:00Z',
        signedAt: '2025-04-10',
        expiresAt: '2026-04-10',
        risk: 'high',
        exposure: 12000,
      },
    ]
  }
  return []
}

function computeAvgRisk(contracts: { risk?: Severity | null }[]): Severity | null {
  const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  const ranks = contracts.map((c) => c.risk && rank[c.risk]).filter(Boolean) as number[]
  if (ranks.length === 0) return null
  const avg = ranks.reduce((s, r) => s + r, 0) / ranks.length
  if (avg >= 3.5) return 'critical'
  if (avg >= 2.5) return 'high'
  if (avg >= 1.5) return 'medium'
  return 'low'
}

type Row = (CgContract | HistoricalRow) & { historical?: boolean }

export function CounterpartyPage({
  contracts,
  counterpartyName,
  onOpen,
  ...chrome
}: ChromeProps & {
  contracts: CgContract[]
  counterpartyName?: string
  onOpen?: (id: string) => void
}) {
  const name = counterpartyName ?? 'Acme Cloud Services, Inc.'
  const theirs = contracts.filter((c) =>
    (c.counterparty ?? '').toLowerCase().includes(name.toLowerCase()),
  )
  const historical = theirs.length < 2 ? FAKE_HISTORICAL_FOR(name) : []
  const all: Row[] = [...theirs, ...historical]

  const totalExposure = all.reduce(
    (s, c) => s + ('exposure' in c && c.exposure != null ? c.exposure : estimateExposure(c as CgContract)),
    0,
  )
  const avgRisk = computeAvgRisk(all)
  const sortedByDate = all.length
    ? all.slice().sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
    : []
  const lastSeen = sortedByDate[0]?.uploadedAt ?? null
  const firstSeen = sortedByDate[sortedByDate.length - 1]?.uploadedAt ?? null

  const clauseTypeCount: Record<string, number> = {}
  for (const c of all)
    for (const cl of (c as CgContract).clauses ?? [])
      clauseTypeCount[cl.type] = (clauseTypeCount[cl.type] ?? 0) + 1
  const topTypes = Object.entries(clauseTypeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <PageShell currentRoute="counterparty" narrow {...chrome}>
      <div className="anim-fade-up flex items-start gap-5 flex-wrap">
        <Avatar name={name} size={72} />
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--ink-3)' }}
          >
            Counterparty
          </p>
          <h1
            className="font-display mt-1 text-[36px] md:text-[44px] leading-[1.15]"
            style={{ color: 'var(--ink)' }}
          >
            {name}
          </h1>
          <p className="text-[14px] mt-2" style={{ color: 'var(--ink-2)' }}>
            {all.length} contract{all.length === 1 ? '' : 's'} on file
            {firstSeen && <> · first seen {formatDate(firstSeen, { short: true })}</>}
          </p>
        </div>
      </div>

      <section className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KPI
          label="Contracts"
          value={all.length}
          sub={`${theirs.length} active, ${historical.length} historical`}
        />
        <KPI
          label="Avg risk"
          value={(avgRisk ?? '—').toString().replace(/^./, (c) => c.toUpperCase())}
          tone={
            avgRisk === 'critical'
              ? 'critical'
              : avgRisk === 'high'
                ? 'high'
                : avgRisk === 'low'
                  ? 'low'
                  : 'default'
          }
        />
        <KPI
          label="Total exposure"
          value={`$${Math.round(totalExposure / 1000)}k`}
          sub="across all contracts"
        />
        <KPI label="Last contract" value={lastSeen ? relativeTime(lastSeen) : '—'} />
      </section>

      {topTypes.length > 0 && (
        <section
          className="mt-8 rounded-xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--ink-3)' }}
          >
            Their tendencies
          </p>
          <p
            className="font-display text-[22px] leading-tight mt-1.5"
            style={{ color: 'var(--ink)' }}
          >
            What this counterparty typically asks for
          </p>

          <ul className="mt-5 space-y-3">
            {topTypes.map(([type, n]) => {
              const max = topTypes[0][1]
              const label = type
                .split('_')
                .map((w) => w[0].toUpperCase() + w.slice(1))
                .join(' ')
              return (
                <li
                  key={type}
                  className="grid grid-cols-[140px_1fr_auto] items-center gap-4"
                >
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: 'var(--ink)' }}
                  >
                    {label}
                  </span>
                  <span
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: 'var(--line-2)' }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(n / max) * 100}%`, background: 'var(--primary)' }}
                    />
                  </span>
                  <span
                    className="font-mono text-[12.5px] tabular-nums"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {n}×
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--line-2)' }}>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              <em>From past contracts:</em> {name.split(/[, ]/)[0]} typically uses 60-day
              non-renewal notice windows and one-month liability caps. Liability caps and
              indemnification scope are the most successful asks to push back on.
            </p>
          </div>
        </section>
      )}

      <section className="mt-8">
        <SectionLabel
          kicker="Contracts on file"
          subtitle={`${all.length} ${all.length === 1 ? 'agreement' : 'agreements'} with ${name.split(',')[0]}`}
        />

        <div
          className="mt-4 rounded-xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          {all.map((c, i) => {
            const clauses = (c as CgContract).clauses ?? []
            const counts = {
              critical: clauses.filter((cl) => cl.severity === 'critical').length,
              high: clauses.filter((cl) => cl.severity === 'high').length,
            }
            const historicalRow = !!c.historical
            return (
              <button
                key={c.id ?? i}
                onClick={() => !historicalRow && onOpen?.(c.id)}
                disabled={historicalRow}
                className={`w-full grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 text-left transition ${
                  historicalRow ? 'opacity-60 cursor-default' : 'hover:bg-black/[.02]'
                }`}
                style={{
                  borderBottom: i === all.length - 1 ? 'none' : '1px solid var(--line-2)',
                }}
              >
                <div className="min-w-0">
                  <p
                    className="text-[14px] font-medium truncate"
                    style={{ color: 'var(--ink)' }}
                  >
                    {c.kind}
                  </p>
                  <p
                    className="text-[11.5px] mt-0.5"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {historicalRow ? (
                      <em>
                        Archived{' '}
                        {(c as HistoricalRow).signedAt
                          ? formatDate((c as HistoricalRow).signedAt)
                          : ''}
                      </em>
                    ) : (
                      c.name
                    )}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  {counts.critical + counts.high > 0 && (
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      {counts.critical + counts.high} flagged
                    </span>
                  )}
                  {c.lifecycle ? <LifecycleChip lifecycle={c.lifecycle} /> : null}
                </div>
                <div className="hidden md:block w-24 text-right">
                  <p className="font-mono text-xs" style={{ color: 'var(--ink-2)' }}>
                    $
                    {Math.round(
                      ('exposure' in c && c.exposure != null
                        ? c.exposure
                        : estimateExposure(c as CgContract)) / 1000,
                    )}
                    k
                  </p>
                  <p
                    className="font-mono text-[10px] mt-0.5"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {c.expiresAt
                      ? formatDate(c.expiresAt, { short: true })
                      : (c as HistoricalRow).signedAt
                        ? formatDate((c as HistoricalRow).signedAt, { short: true })
                        : '—'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <p className="text-center mt-12 text-[12px]" style={{ color: 'var(--ink-3)' }}>
        Counterparty tendencies are inferred from this account&apos;s history. Historical patterns
        are not a guarantee.
      </p>
    </PageShell>
  )
}
