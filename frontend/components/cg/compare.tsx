'use client'

// components/cg/compare.tsx — side-by-side comparison of two contracts.
import * as React from 'react'
import { Icon } from './icons'
import { PageShell, type ChromeProps } from './topbar'
import { Avatar, RiskGauge, SectionLabel, VerdictPill } from './primitives'
import { formatDate, type CgContract, type Severity } from '@/lib/cg/data'

export function ComparePage({
  contracts,
  onOpen,
  ...chrome
}: ChromeProps & {
  contracts: CgContract[]
  onOpen: (id: string) => void
}) {
  const eligible = contracts.filter((c) => c.status === 'complete')
  const [leftId, setLeftId] = React.useState<string | undefined>(eligible[0]?.id)
  const [rightId, setRightId] = React.useState<string | undefined>(eligible[1]?.id)

  const left = contracts.find((c) => c.id === leftId)
  const right = contracts.find((c) => c.id === rightId)

  return (
    <PageShell currentRoute="compare" {...chrome}>
      <div className="anim-fade-up">
        <p
          className="text-[11px] uppercase tracking-[0.16em] font-medium"
          style={{ color: 'var(--ink-3)' }}
        >
          Compare
        </p>
        <h1
          className="font-display mt-1.5 text-[40px] md:text-[48px] leading-[1.15]"
          style={{ color: 'var(--ink)' }}
        >
          Two contracts, <em>side by side.</em>
        </h1>
        <p
          className="text-[15px] leading-[1.6] mt-4 max-w-2xl"
          style={{ color: 'var(--ink-2)' }}
        >
          See how two agreements stack up — risk, exposure, what&apos;s in one but not the other.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <ContractPicker
          contracts={eligible}
          value={leftId}
          onChange={setLeftId}
          label="Contract A"
        />
        <ContractPicker
          contracts={eligible}
          value={rightId}
          onChange={setRightId}
          label="Contract B"
        />
      </div>

      {left && right ? (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ContractSnapshot contract={left} onOpen={onOpen} side="left" />
          <ContractSnapshot contract={right} onOpen={onOpen} side="right" />
        </div>
      ) : (
        <p className="mt-8 text-center text-sm" style={{ color: 'var(--ink-3)' }}>
          Pick two contracts to compare.
        </p>
      )}

      {left && right && (
        <section className="mt-12">
          <SectionLabel kicker="Differences" subtitle="What stands out between them" />
          <Differences left={left} right={right} />
        </section>
      )}
    </PageShell>
  )
}

function ContractPicker({
  contracts,
  value,
  onChange,
  label,
}: {
  contracts: CgContract[]
  value: string | undefined
  onChange: (v: string) => void
  label: string
}) {
  return (
    <label className="block">
      <span
        className="text-[10px] uppercase tracking-[0.14em] font-medium"
        style={{ color: 'var(--ink-3)' }}
      >
        {label}
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md px-3 py-2.5 text-[14px] outline-none transition appearance-none cursor-pointer"
        style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)' }}
      >
        {contracts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.counterparty} — {c.kind}
          </option>
        ))}
      </select>
    </label>
  )
}

function ContractSnapshot({
  contract,
  onOpen,
  side,
}: {
  contract: CgContract
  onOpen: (id: string) => void
  side: 'left' | 'right'
}) {
  const counts = {
    critical: contract.clauses.filter((c) => c.severity === 'critical').length,
    high: contract.clauses.filter((c) => c.severity === 'high').length,
    medium: contract.clauses.filter((c) => c.severity === 'medium').length,
    low: contract.clauses.filter((c) => c.severity === 'low').length,
  }

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <header className="p-5 border-b" style={{ borderColor: 'var(--line-2)' }}>
        <div className="flex items-start gap-3">
          <Avatar name={contract.counterparty} size={36} />
          <div className="min-w-0 flex-1">
            <p
              className="text-[10.5px] uppercase tracking-[0.14em] font-medium"
              style={{ color: 'var(--ink-3)' }}
            >
              {side === 'left' ? 'Contract A' : 'Contract B'}
            </p>
            <p
              className="text-[14px] font-medium leading-tight mt-0.5 truncate"
              style={{ color: 'var(--ink)' }}
            >
              {contract.counterparty}
            </p>
            <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              {contract.kind}
            </p>
          </div>
          <VerdictPill verdict={contract.verdict} />
        </div>
      </header>

      <div
        className="p-5 flex items-center gap-5 border-b"
        style={{ borderColor: 'var(--line-2)' }}
      >
        <RiskGauge risk={contract.risk} size={140} />
        <div className="flex-1 space-y-2">
          {(
            [
              { sev: 'critical', label: 'Critical' },
              { sev: 'high', label: 'High' },
              { sev: 'medium', label: 'Medium' },
              { sev: 'low', label: 'Low' },
            ] as { sev: Severity; label: string }[]
          ).map((r) => (
            <div key={r.sev} className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: `var(--${r.sev})` }}
              />
              <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                {r.label}
              </span>
              <span
                className="font-mono text-sm ml-auto"
                style={{ color: counts[r.sev] > 0 ? `var(--${r.sev})` : 'var(--ink-3)' }}
              >
                {counts[r.sev]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 flex-1">
        <p
          className="text-[11px] uppercase tracking-[0.14em] font-medium mb-2"
          style={{ color: 'var(--ink-3)' }}
        >
          Our take
        </p>
        <p className="text-[13.5px] leading-[1.6]" style={{ color: 'var(--ink-2)' }}>
          {contract.verdictNote}
        </p>
      </div>

      <footer
        className="px-5 py-4 border-t flex items-center justify-between"
        style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
      >
        <div className="flex flex-col">
          <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {contract.pages || '—'} pages
          </span>
          {contract.expiresAt && (
            <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
              expires {formatDate(contract.expiresAt, { short: true })}
            </span>
          )}
        </div>
        <button
          onClick={() => onOpen(contract.id)}
          className="inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: 'var(--primary)' }}
        >
          Open <Icon.ArrowRight size={13} />
        </button>
      </footer>
    </div>
  )
}

function Differences({ left, right }: { left: CgContract; right: CgContract }) {
  const leftTypes = new Set(left.clauses.map((c) => c.type))
  const rightTypes = new Set(right.clauses.map((c) => c.type))
  const onlyLeft = [...leftTypes].filter((t) => !rightTypes.has(t))
  const onlyRight = [...rightTypes].filter((t) => !leftTypes.has(t))
  const shared = [...leftTypes].filter((t) => rightTypes.has(t))

  const riskRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  const leftRisk = (left.risk && riskRank[left.risk]) ?? 0
  const rightRisk = (right.risk && riskRank[right.risk]) ?? 0
  const riskier = leftRisk === rightRisk ? null : leftRisk > rightRisk ? 'left' : 'right'

  const typeLabel = (t: string) =>
    t
      .split('_')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ')

  const observations: { headline: string; detail: string; tone: 'high' | 'medium' | 'default' }[] =
    []
  if (riskier) {
    observations.push({
      headline: `${
        riskier === 'left' ? left.counterparty : right.counterparty
      } carries more risk overall`,
      detail: `${
        riskier === 'left' ? left.counterparty : right.counterparty
      } comes in at ${riskier === 'left' ? left.risk : right.risk} risk vs. ${
        riskier === 'left' ? right.risk : left.risk
      } for the other.`,
      tone: 'high',
    })
  }
  if (onlyLeft.length) {
    observations.push({
      headline: `Only in ${left.counterparty}: ${onlyLeft.map(typeLabel).join(', ')}`,
      detail:
        'These clause types appear in this contract but not the other. Worth understanding why.',
      tone: 'medium',
    })
  }
  if (onlyRight.length) {
    observations.push({
      headline: `Only in ${right.counterparty}: ${onlyRight.map(typeLabel).join(', ')}`,
      detail: 'These clause types appear in this contract but not the other.',
      tone: 'medium',
    })
  }
  if (shared.length) {
    observations.push({
      headline: `Both have ${shared.map(typeLabel).join(', ')}`,
      detail:
        'Useful to compare the wording on these — see where one is more favorable to you.',
      tone: 'default',
    })
  }

  if (observations.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
        Not much to call out — these two are remarkably similar.
      </p>
    )
  }

  const tones = { high: 'var(--high)', medium: 'var(--medium)', default: 'var(--primary)' }
  const bg = {
    high: 'var(--high-bg)',
    medium: 'var(--medium-bg)',
    default: 'var(--primary-2)',
  }

  return (
    <ul className="mt-4 space-y-3">
      {observations.map((o, i) => (
        <li
          key={i}
          className="rounded-lg p-4 flex items-start gap-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <span
            className="grid place-items-center w-6 h-6 rounded-full shrink-0 mt-0.5"
            style={{ background: bg[o.tone], color: tones[o.tone] }}
          >
            <Icon.AlertTriangle size={11} />
          </span>
          <div>
            <p
              className="text-[14px] font-medium leading-snug"
              style={{ color: 'var(--ink)' }}
            >
              {o.headline}
            </p>
            <p
              className="text-[12.5px] leading-snug mt-1"
              style={{ color: 'var(--ink-3)' }}
            >
              {o.detail}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
