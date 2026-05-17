'use client'

// components/cg/analytics.tsx — cross-contract risk profile + stats.
import * as React from 'react'
import { PageShell, type ChromeProps } from './topbar'
import { Avatar, RiskBar, RiskChip } from './primitives'
import type { CgContract, Severity } from '@/lib/cg/data'

// Estimated $ exposure. Real backend doesn't track contract value yet, so this
// is a heuristic stand-in for the analytics view.
const FALLBACK_EXPOSURE: Record<string, number> = {
  'c-acme-msa': 14400,
  'c-office-lease': 50400,
  'c-contractor-msa': 8000,
  'c-employment-offer': 135000,
  'c-nda-vendor': 0,
}
export function estimateExposure(c: CgContract): number {
  if (typeof c.exposure === 'number') return c.exposure
  return FALLBACK_EXPOSURE[c.id] ?? 0
}

export function KPI({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  sub?: string
  tone?: 'default' | 'critical' | 'high' | 'low'
}) {
  const toneColor =
    tone === 'critical'
      ? 'var(--critical)'
      : tone === 'high'
        ? 'var(--high)'
        : tone === 'low'
          ? 'var(--low)'
          : 'var(--ink)'
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <p
        className="text-[10.5px] uppercase tracking-[0.14em] font-medium"
        style={{ color: 'var(--ink-3)' }}
      >
        {label}
      </p>
      <p className="font-display text-[36px] leading-none mt-2.5" style={{ color: toneColor }}>
        {value}
      </p>
      {sub && (
        <p className="text-[11.5px] mt-2" style={{ color: 'var(--ink-3)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function DonutFromCounts({
  counts,
}: {
  counts: Record<Severity, number>
}) {
  const order: Severity[] = ['critical', 'high', 'medium', 'low']
  const total = order.reduce((s, k) => s + counts[k], 0) || 1
  const radius = 56,
    stroke = 18,
    cx = 80,
    cy = 80
  const circ = 2 * Math.PI * radius

  let offset = 0
  return (
    <div className="mt-5 grid place-items-center relative">
      <svg
        viewBox="0 0 160 160"
        width="160"
        height="160"
        role="img"
        aria-label="Clause severity distribution"
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--line-2)"
          strokeWidth={stroke}
        />
        {order.map((sev) => {
          const n = counts[sev]
          if (n === 0) return null
          const frac = n / total
          const dash = frac * circ
          const seg = (
            <circle
              key={sev}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={`var(--${sev})`}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray .8s ease, stroke-dashoffset .8s ease' }}
            />
          )
          offset += dash
          return seg
        })}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize="28"
          fontFamily="Instrument Serif, serif"
          fill="var(--ink)"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize="9"
          fontFamily="Geist Mono"
          fill="var(--ink-3)"
          letterSpacing="1.5"
        >
          CLAUSES
        </text>
      </svg>
    </div>
  )
}

export function AnalyticsPage({
  contracts,
  onOpen,
  ...chrome
}: ChromeProps & {
  contracts: CgContract[]
  onOpen: (id: string) => void
}) {
  const complete = contracts.filter((c) => c.status === 'complete')
  const totalClauses = complete.reduce((sum, c) => sum + c.clauses.length, 0)
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  const clauseTypeCount: Record<string, number> = {}
  for (const c of complete) {
    for (const cl of c.clauses) {
      counts[cl.severity] = (counts[cl.severity] ?? 0) + 1
      clauseTypeCount[cl.type] = (clauseTypeCount[cl.type] ?? 0) + 1
    }
  }
  const topClauseTypes = Object.entries(clauseTypeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const contractRisk: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    none: 0,
  }
  for (const c of complete) {
    if (c.risk) contractRisk[c.risk]++
    else contractRisk.none++
  }

  const totalExposure = complete.reduce((s, c) => s + estimateExposure(c), 0)
  const atRiskExposure = complete
    .filter((c) => c.risk === 'critical' || c.risk === 'high')
    .reduce((s, c) => s + estimateExposure(c), 0)

  return (
    <PageShell currentRoute="analytics" {...chrome}>
      <div className="anim-fade-up">
        <p
          className="text-[11px] uppercase tracking-[0.16em] font-medium"
          style={{ color: 'var(--ink-3)' }}
        >
          Analytics
        </p>
        <h1
          className="font-display mt-1.5 text-[44px] md:text-[56px] leading-[1.12]"
          style={{ color: 'var(--ink)' }}
        >
          Your risk profile.
        </h1>
        <p
          className="text-[15px] leading-[1.6] mt-4 max-w-2xl"
          style={{ color: 'var(--ink-2)' }}
        >
          A bird&apos;s-eye view of every contract you&apos;ve planted. What&apos;s exposing you.
          What&apos;s safe. What&apos;s coming.
        </p>
      </div>

      <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KPI
          label="Contracts"
          value={complete.length}
          sub={`${contracts.length - complete.length} pending`}
        />
        <KPI
          label="Annual exposure"
          value={`$${Math.round(totalExposure / 1000)}k`}
          sub="committed across active"
        />
        <KPI
          label="At risk"
          value={`$${Math.round(atRiskExposure / 1000)}k`}
          sub={`${contractRisk.critical + contractRisk.high} contract${
            contractRisk.critical + contractRisk.high === 1 ? '' : 's'
          }`}
          tone={atRiskExposure > 0 ? 'high' : 'low'}
        />
        <KPI
          label="Clauses flagged"
          value={counts.critical + counts.high}
          sub={`out of ${totalClauses} total`}
          tone={counts.critical > 0 ? 'critical' : 'default'}
        />
      </section>

      <section className="mt-8 grid grid-cols-12 gap-4 md:gap-5">
        <div
          className="col-span-12 md:col-span-7 rounded-xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--ink-3)' }}
          >
            Contracts by risk
          </p>
          <p
            className="font-display text-[24px] leading-tight mt-1.5"
            style={{ color: 'var(--ink)' }}
          >
            {complete.length} {complete.length === 1 ? 'contract' : 'contracts'} analyzed
          </p>

          <RiskBar
            critical={contractRisk.critical}
            high={contractRisk.high}
            medium={contractRisk.medium}
            low={contractRisk.low}
          />

          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {(
              [
                { sev: 'critical', label: 'Critical', n: contractRisk.critical },
                { sev: 'high', label: 'High', n: contractRisk.high },
                { sev: 'medium', label: 'Medium', n: contractRisk.medium },
                { sev: 'low', label: 'Low', n: contractRisk.low },
              ] as { sev: Severity; label: string; n: number }[]
            ).map((r) => (
              <li key={r.sev} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: `var(--${r.sev})` }}
                />
                <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                  {r.label}
                </span>
                <span
                  className="font-mono text-sm font-semibold ml-auto"
                  style={{ color: `var(--${r.sev})` }}
                >
                  {r.n}
                </span>
              </li>
            ))}
          </ul>

          {complete.filter((c) => c.risk === 'critical' || c.risk === 'high').length > 0 && (
            <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--line-2)' }}>
              <p
                className="text-[11px] uppercase tracking-[0.14em] font-medium mb-3"
                style={{ color: 'var(--ink-3)' }}
              >
                Needs your attention
              </p>
              <ul className="space-y-2">
                {complete
                  .filter((c) => c.risk === 'critical' || c.risk === 'high')
                  .map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => onOpen(c.id)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md transition hover:bg-black/[.02]"
                      >
                        <Avatar name={c.counterparty} size={26} />
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[13px] font-medium truncate"
                            style={{ color: 'var(--ink)' }}
                          >
                            {c.counterparty}
                          </p>
                          <p
                            className="text-[11px] truncate"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {c.kind}
                          </p>
                        </div>
                        <RiskChip risk={c.risk} />
                        <span
                          className="font-mono text-[11.5px]"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          ${estimateExposure(c).toLocaleString()}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        <div
          className="col-span-12 md:col-span-5 rounded-xl p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--ink-3)' }}
          >
            Clause severity
          </p>
          <p
            className="font-display text-[24px] leading-tight mt-1.5"
            style={{ color: 'var(--ink)' }}
          >
            {totalClauses} clauses across portfolio
          </p>

          <DonutFromCounts counts={counts} />

          <ul className="space-y-2 mt-4">
            {(
              [
                { sev: 'critical', label: 'Critical', n: counts.critical },
                { sev: 'high', label: 'High', n: counts.high },
                { sev: 'medium', label: 'Medium', n: counts.medium },
                { sev: 'low', label: 'Low', n: counts.low },
              ] as { sev: Severity; label: string; n: number }[]
            ).map((r) => (
              <li key={r.sev} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: `var(--${r.sev})` }}
                  />
                  <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                    {r.label}
                  </span>
                </span>
                <span
                  className="font-mono text-sm tabular-nums"
                  style={{ color: `var(--${r.sev})` }}
                >
                  {r.n}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="mt-8 rounded-xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <p
          className="text-[11px] uppercase tracking-[0.16em] font-medium"
          style={{ color: 'var(--ink-3)' }}
        >
          Most-flagged clauses
        </p>
        <p
          className="font-display text-[24px] leading-tight mt-1.5"
          style={{ color: 'var(--ink)' }}
        >
          Where the bodies are buried
        </p>
        <p className="text-[13px] mt-2 max-w-xl" style={{ color: 'var(--ink-2)' }}>
          The clause types we&apos;ve flagged most often across your portfolio. Worth knowing what
          to look for next time.
        </p>

        {topClauseTypes.length === 0 ? (
          <p className="mt-5 text-sm" style={{ color: 'var(--ink-3)' }}>
            No analyzed clauses yet.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {topClauseTypes.map(([type, n]) => {
              const max = topClauseTypes[0][1]
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
                      className="block h-full rounded-full transition-all"
                      style={{ width: `${(n / max) * 100}%`, background: 'var(--primary)' }}
                    />
                  </span>
                  <span
                    className="font-mono text-sm tabular-nums"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {n}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="text-center mt-12 text-[12px]" style={{ color: 'var(--ink-3)' }}>
        Estimates based on the contract amounts we found. For your real risk picture, please
        consult an attorney.
      </p>
    </PageShell>
  )
}
