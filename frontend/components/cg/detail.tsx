'use client'

// components/cg/detail.tsx — contract detail: verdict hero + clauses + timeline.
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import {
  Avatar,
  Btn,
  Kbd,
  LifecycleChip,
  RiskChip,
  SectionLabel,
  SEV_COLOR,
  VERDICT_STYLE,
  VerdictPill,
} from './primitives'
import { renderWithGlossary } from './glossary'
import {
  daysUntil,
  formatDate,
  relativeTime,
  type CgClause,
  type CgComment,
  type CgContract,
  type TriageDecision,
} from '@/lib/cg/data'

function scrollClauseIntoView(id: string) {
  setTimeout(() => {
    const el = document.getElementById(`clause-${id}`)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const target = window.scrollY + rect.top - 96
    window.scrollTo({ top: target, behavior: 'smooth' })
  }, 30)
}

type TriageMap = Record<string, TriageDecision | null | undefined>
type NotesMap = Record<string, string | null | undefined>
type CommentsMap = Record<string, CgComment[]>

export interface ContractDetailProps {
  contract: CgContract
  onBack: () => void
  triageState: TriageMap
  setTriage: (id: string, v: TriageDecision | null) => void
  notes: NotesMap
  setNote: (id: string, v: string | null) => void
  comments: CommentsMap
  addComment: (clauseId: string, text: string) => void
  onGenerateCounter: () => void
}

export function ContractDetail({
  contract,
  onBack,
  triageState,
  setTriage,
  notes,
  setNote,
  comments,
  addComment,
  onGenerateCounter,
}: ContractDetailProps) {
  const [activeClauseId, setActiveClauseId] = React.useState<string | null>(null)
  const [layoutMode, setLayoutMode] = React.useState<'stacked' | 'sideBySide'>('stacked')

  const isSigned =
    contract.lifecycle === 'signed' ||
    contract.lifecycle === 'active' ||
    contract.lifecycle === 'archived'

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).matches('input, textarea, [contenteditable]')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const clauses = contract.clauses ?? []
      if (clauses.length === 0) return

      const idx = clauses.findIndex((c) => c.id === activeClauseId)
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        const next = idx < 0 ? 0 : Math.min(clauses.length - 1, idx + 1)
        setActiveClauseId(clauses[next].id)
        scrollClauseIntoView(clauses[next].id)
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = idx < 0 ? 0 : Math.max(0, idx - 1)
        setActiveClauseId(clauses[next].id)
        scrollClauseIntoView(clauses[next].id)
      } else if (e.key === 'Escape' && activeClauseId) {
        setActiveClauseId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeClauseId, contract.clauses])

  if (contract.status === 'analyzing' || contract.status === 'processing')
    return <AnalyzingState contract={contract} onBack={onBack} />
  if (contract.status === 'failed') return <FailedState contract={contract} onBack={onBack} />

  const counts = {
    critical: contract.clauses.filter((c) => c.severity === 'critical').length,
    high: contract.clauses.filter((c) => c.severity === 'high').length,
    medium: contract.clauses.filter((c) => c.severity === 'medium').length,
    low: contract.clauses.filter((c) => c.severity === 'low').length,
  }

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
      <DetailHeader contract={contract} onBack={onBack} />

      <main
        className="max-w-[1200px] mx-auto px-6 md:px-10 pb-24 pt-8 relative"
        style={{ zIndex: 1 }}
      >
        {isSigned ? (
          <SignedHero contract={contract} />
        ) : (
          <VerdictHero contract={contract} counts={counts} />
        )}

        <div className="mt-10 grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            <ClauseColumn
              clauses={contract.clauses}
              counts={counts}
              triageState={triageState}
              setTriage={setTriage}
              notes={notes}
              setNote={setNote}
              comments={comments}
              addComment={addComment}
              activeId={activeClauseId}
              setActiveId={setActiveClauseId}
              layoutMode={layoutMode}
              setLayoutMode={setLayoutMode}
              readOnly={isSigned}
            />
          </div>
          <aside className="col-span-12 lg:col-span-4">
            <DetailSidebar
              contract={contract}
              triageState={triageState}
              comments={comments}
              activeId={activeClauseId}
              setActiveId={setActiveClauseId}
              onGenerateCounter={onGenerateCounter}
              readOnly={isSigned}
            />
          </aside>
        </div>
      </main>
    </div>
  )
}

function DetailHeader({ contract, onBack }: { contract: CgContract; onBack: () => void }) {
  const router = useRouter()
  const readMin = Math.max(1, Math.round((30 * (contract.clauses?.length ?? 0) + 60) / 60))
  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: 'color-mix(in oklch, var(--bg) 92%, transparent)',
        borderColor: 'var(--line)',
        backdropFilter: 'blur(10px) saturate(160%)',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-16 flex items-center gap-4">
        <button
          onClick={onBack}
          className="grid place-items-center w-9 h-9 rounded-md hover:bg-black/5 transition"
          style={{ color: 'var(--ink-2)' }}
          aria-label="Back"
        >
          <Icon.ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--ink-3)' }}
          >
            {contract.kind}
          </p>
          <button
            onClick={() => router.push('/counterparty')}
            className="text-[14px] font-medium truncate hover:underline underline-offset-2 decoration-dotted"
            style={{ color: 'var(--ink)' }}
            title="View counterparty profile"
          >
            {contract.counterparty}
          </button>
        </div>
        {contract.status === 'complete' && contract.clauses?.length > 0 && (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 text-[11.5px] font-mono"
            style={{ color: 'var(--ink-3)' }}
          >
            <Icon.Clock size={11} /> {readMin}-min read
          </span>
        )}
        {contract.lifecycle && <LifecycleChip lifecycle={contract.lifecycle} />}
        <div className="hidden md:flex items-center gap-2">
          <Btn variant="ghost" size="sm" icon={Icon.FileText}>
            View source
          </Btn>
          <Btn variant="ghost" size="sm" icon={Icon.Send}>
            Share with lawyer
          </Btn>
          <button
            className="grid place-items-center w-9 h-9 rounded-md hover:bg-black/5 transition"
            style={{ color: 'var(--ink-3)' }}
            aria-label="More"
          >
            <Icon.MoreHorizontal size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}

function SignedHero({ contract }: { contract: CgContract }) {
  const isActive = contract.lifecycle === 'active'
  const isArchived = contract.lifecycle === 'archived'
  const kicker = isArchived
    ? 'Tended · archived'
    : isActive
      ? 'Signed and tended · in effect'
      : 'Signed and tended'
  const dateStr = contract.signedAt ? formatDate(contract.signedAt) : 'earlier'

  return (
    <section className="anim-fade-up">
      <div className="flex items-start gap-2 mb-3">
        <span
          className="grid place-items-center w-6 h-6 rounded-full"
          style={{ background: 'var(--low-bg)', color: 'var(--low)' }}
        >
          <Icon.Check size={12} />
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.16em] font-medium pt-0.5"
          style={{ color: 'var(--low)' }}
        >
          {kicker}
        </span>
      </div>

      <h2
        className="font-display text-[40px] md:text-[56px] leading-[1.15] tracking-tight max-w-3xl"
        style={{ color: 'var(--ink)' }}
      >
        Signed on {dateStr}. <em style={{ color: 'var(--low)' }}>This one&apos;s done.</em>
      </h2>
      <p className="mt-6 max-w-2xl text-[16px] leading-[1.6]" style={{ color: 'var(--ink-2)' }}>
        {contract.verdictNote}
      </p>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.6]" style={{ color: 'var(--ink-3)' }}>
        {contract.summary}
      </p>

      <div
        className="mt-7 rounded-xl overflow-hidden grid grid-cols-3 md:grid-cols-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <Stat label="Status" value={<LifecycleChip lifecycle={contract.lifecycle} />} />
        <Stat
          label="Signed"
          value={
            <span className="font-mono text-sm" style={{ color: 'var(--ink-2)' }}>
              {contract.signedAt ? formatDate(contract.signedAt, { short: true }) : '—'}
            </span>
          }
        />
        <Stat
          label="Clauses"
          value={<span className="font-display text-[22px] md:text-[24px]">{contract.clauses.length}</span>}
        />
        <Stat
          label="Pages"
          value={
            <span className="font-mono text-sm" style={{ color: 'var(--ink-2)' }}>
              {contract.pages || '—'}
            </span>
          }
        />
        <Stat
          label="Expires"
          value={
            <span className="font-mono text-sm" style={{ color: 'var(--ink-2)' }}>
              {contract.expiresAt ? formatDate(contract.expiresAt, { short: true }) : 'Open-ended'}
            </span>
          }
        />
        <Stat
          label="Uploaded"
          value={
            <span className="font-mono text-sm" style={{ color: 'var(--ink-2)' }}>
              {formatDate(contract.uploadedAt, { short: true })}
            </span>
          }
          last
        />
      </div>
    </section>
  )
}

function VerdictHero({
  contract,
  counts,
}: {
  contract: CgContract
  counts: { critical: number; high: number; medium: number; low: number }
}) {
  const v = contract.verdict ? VERDICT_STYLE[contract.verdict] : undefined
  const HEADLINES: Record<string, string> = {
    sign: 'Looks good. Safe to sign as-is.',
    'sign-with-edits': 'Reasonable contract — but make a couple of edits first.',
    negotiate: "We'd push back before you sign this one.",
    decline: "We'd hold off on signing until this is rewritten.",
  }
  const headline = HEADLINES[contract.verdict ?? ''] ?? 'Reading this contract…'
  const IconCmp = v ? Icon[v.icon] : Icon.Leaf

  return (
    <section className="anim-fade-up">
      <div className="flex items-start gap-2 mb-3">
        <span
          className="grid place-items-center w-6 h-6 rounded-full"
          style={{ background: v?.bg, color: v?.fg }}
        >
          <IconCmp size={12} />
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.16em] font-medium pt-0.5"
          style={{ color: v?.fg }}
        >
          Our take
        </span>
      </div>

      <h2
        className="font-display text-[40px] md:text-[56px] leading-[1.15] tracking-tight max-w-3xl"
        style={{ color: 'var(--ink)' }}
      >
        {headline}
      </h2>
      <p className="mt-6 max-w-2xl text-[16px] leading-[1.6]" style={{ color: 'var(--ink-2)' }}>
        {contract.verdictNote}
      </p>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.6]" style={{ color: 'var(--ink-3)' }}>
        {contract.summary}
      </p>

      <div
        className="mt-7 rounded-xl overflow-hidden grid grid-cols-3 md:grid-cols-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <Stat label="Verdict" value={<VerdictPill verdict={contract.verdict} />} />
        <Stat
          label="Clauses"
          value={<span className="font-display text-[22px] md:text-[24px]">{contract.clauses.length}</span>}
        />
        <Stat
          label="Critical"
          value={
            <span
              className="font-display text-[22px] md:text-[24px]"
              style={{ color: counts.critical > 0 ? 'var(--critical)' : 'var(--ink-3)' }}
            >
              {counts.critical}
            </span>
          }
        />
        <Stat
          label="High"
          value={
            <span
              className="font-display text-[22px] md:text-[24px]"
              style={{ color: counts.high > 0 ? 'var(--high)' : 'var(--ink-3)' }}
            >
              {counts.high}
            </span>
          }
        />
        <Stat
          label="Pages"
          value={
            <span className="font-mono text-sm" style={{ color: 'var(--ink-2)' }}>
              {contract.pages || '—'}
            </span>
          }
        />
        <Stat
          label="Uploaded"
          value={
            <span className="font-mono text-sm" style={{ color: 'var(--ink-2)' }}>
              {formatDate(contract.uploadedAt, { short: true })}
            </span>
          }
          last
        />
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  last,
}: {
  label: string
  value: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className="px-4 md:px-5 py-3 md:py-4 flex flex-col gap-1 border-t border-l first:border-l-0 md:border-t-0 [&:nth-child(-n+3)]:border-t-0 md:[&:nth-child(4)]:border-l"
      style={{ borderColor: 'var(--line-2)' }}
      data-last={last ? '1' : undefined}
    >
      <p
        className="text-[10px] uppercase tracking-[0.14em] font-medium"
        style={{ color: 'var(--ink-3)' }}
      >
        {label}
      </p>
      <div>{value}</div>
    </div>
  )
}

function ClauseColumn({
  clauses,
  counts,
  triageState,
  setTriage,
  notes,
  setNote,
  comments,
  addComment,
  activeId,
  setActiveId,
  layoutMode,
  setLayoutMode,
  readOnly,
}: {
  clauses: CgClause[]
  counts: { critical: number; high: number; medium: number; low: number }
  triageState: TriageMap
  setTriage: (id: string, v: TriageDecision | null) => void
  notes: NotesMap
  setNote: (id: string, v: string | null) => void
  comments: CommentsMap
  addComment: (clauseId: string, text: string) => void
  activeId: string | null
  setActiveId: (id: string | null) => void
  layoutMode: 'stacked' | 'sideBySide'
  setLayoutMode: (v: 'stacked' | 'sideBySide') => void
  readOnly: boolean
}) {
  const [filter, setFilter] = React.useState('all')
  const filtered = filter === 'all' ? clauses : clauses.filter((c) => c.severity === filter)

  return (
    <section aria-label="Clauses">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
        <SectionLabel
          kicker="The clauses"
          subtitle={
            readOnly
              ? `All ${clauses.length} clauses as signed`
              : `What we found in this ${clauses.length}-clause contract`
          }
        />
        <div className="flex items-center gap-3 flex-wrap">
          <LayoutToggle value={layoutMode} onChange={setLayoutMode} />
          <span
            className="hidden md:inline-flex items-center gap-1.5 text-[11px]"
            style={{ color: 'var(--ink-3)' }}
          >
            <Kbd>J</Kbd>
            <Kbd>K</Kbd> to navigate
          </span>
          <ClauseFilter value={filter} setValue={setFilter} counts={counts} />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((cl, i) => (
          <ClauseCard
            key={cl.id}
            clause={cl}
            index={clauses.indexOf(cl) + 1}
            triage={triageState[cl.id] ?? null}
            setTriage={(v) => setTriage(cl.id, v)}
            note={notes[cl.id]}
            setNote={(v) => setNote(cl.id, v)}
            thread={comments?.[cl.id] ?? []}
            addComment={(text) => addComment(cl.id, text)}
            isOpen={activeId === cl.id || i < 2}
            onToggle={() => setActiveId(activeId === cl.id ? null : cl.id)}
            layoutMode={layoutMode}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  )
}

function LayoutToggle({
  value,
  onChange,
}: {
  value: 'stacked' | 'sideBySide'
  onChange: (v: 'stacked' | 'sideBySide') => void
}) {
  return (
    <div
      className="flex p-0.5 rounded-md"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
    >
      {(
        [
          { key: 'stacked', label: 'Summary', icon: Icon.List },
          { key: 'sideBySide', label: 'Side-by-side', icon: Icon.Grid },
        ] as const
      ).map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition"
          style={
            value === o.key
              ? { background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)' }
              : { color: 'var(--ink-3)' }
          }
        >
          <o.icon size={11} />
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ClauseFilter({
  value,
  setValue,
  counts,
}: {
  value: string
  setValue: (v: string) => void
  counts: { critical: number; high: number; medium: number; low: number }
}) {
  const items = [
    {
      key: 'all',
      label: 'All',
      n: counts.critical + counts.high + counts.medium + counts.low,
      color: 'var(--ink-2)',
    },
    { key: 'critical', label: 'Critical', n: counts.critical, color: 'var(--critical)' },
    { key: 'high', label: 'High', n: counts.high, color: 'var(--high)' },
    { key: 'medium', label: 'Medium', n: counts.medium, color: 'var(--medium)' },
    { key: 'low', label: 'Low', n: counts.low, color: 'var(--low)' },
  ]
  return (
    <div
      className="flex p-0.5 rounded-md"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
    >
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => setValue(it.key)}
          disabled={it.n === 0}
          className="px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 disabled:opacity-30"
          style={
            value === it.key
              ? { background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)' }
              : { color: 'var(--ink-3)' }
          }
        >
          {it.key !== 'all' && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: it.color }} />
          )}
          <span>{it.label}</span>
          <span className="font-mono opacity-60">{it.n}</span>
        </button>
      ))}
    </div>
  )
}

function ClauseCard({
  clause,
  index,
  triage,
  setTriage,
  note,
  setNote,
  thread = [],
  addComment,
  isOpen,
  onToggle,
  layoutMode = 'stacked',
  readOnly = false,
}: {
  clause: CgClause
  index: number
  triage: TriageDecision | null
  setTriage: (v: TriageDecision | null) => void
  note: string | null | undefined
  setNote: (v: string | null) => void
  thread?: CgComment[]
  addComment: (text: string) => void
  isOpen: boolean
  onToggle: () => void
  layoutMode?: 'stacked' | 'sideBySide'
  readOnly?: boolean
}) {
  const c = SEV_COLOR[clause.severity]
  const sideBySide = layoutMode === 'sideBySide'

  return (
    <article
      id={`clause-${clause.id}`}
      className="rounded-xl overflow-hidden transition"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${
          isOpen ? 'color-mix(in oklch, var(--primary) 35%, var(--line))' : 'var(--line)'
        }`,
      }}
    >
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-stretch">
          <div className="w-1 shrink-0" style={{ background: c.fg }} />
          <div className="flex-1 px-5 py-4 flex items-start gap-4">
            <div className="num-circle shrink-0 mt-0.5" style={{ background: c.bg, color: c.fg }}>
              {String(index).padStart(2, '0')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <RiskChip risk={clause.severity} />
                {clause.page != null && (
                  <span className="text-[11px] font-mono" style={{ color: 'var(--ink-3)' }}>
                    p.{clause.page}
                  </span>
                )}
                {triage && <TriageBadge triage={triage} />}
              </div>
              <h3
                className="font-display text-[22px] leading-[1.28] mt-2"
                style={{ color: 'var(--ink)' }}
              >
                {clause.title}
              </h3>
              {!isOpen && (
                <p
                  className="text-sm leading-relaxed mt-1.5 line-clamp-2"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {clause.plain}
                </p>
              )}
            </div>
            <span className="shrink-0 mt-1" style={{ color: 'var(--ink-3)' }}>
              {isOpen ? <Icon.ChevronUp size={16} /> : <Icon.ChevronDown size={16} />}
            </span>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-1 anim-fade-up">
          <div className="md:ml-[40px] grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5">
            {sideBySide ? (
              <>
                <div
                  className="md:col-span-6 rounded-lg p-4"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
                >
                  <p
                    className="text-[10px] uppercase tracking-[0.14em] font-medium mb-2 inline-flex items-center gap-1.5"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    <Icon.Quote size={10} /> Contract language
                  </p>
                  <blockquote
                    className="font-mono text-[12px] leading-[1.7] italic"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    &quot;{clause.raw}&quot;
                  </blockquote>
                </div>
                <div className="md:col-span-6">
                  <p
                    className="text-[10px] uppercase tracking-[0.14em] font-medium mb-2 inline-flex items-center gap-1.5"
                    style={{ color: 'var(--primary)' }}
                  >
                    <Icon.Sparkle size={10} /> What it means
                  </p>
                  <p className="text-[15px] leading-[1.65]" style={{ color: 'var(--ink)' }}>
                    {renderWithGlossary(clause.plain)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-12">
                  <p className="text-[15px] leading-[1.65]" style={{ color: 'var(--ink)' }}>
                    {renderWithGlossary(clause.plain)}
                  </p>
                </div>

                <div className="md:col-span-12">
                  <details className="group">
                    <summary
                      className="list-none cursor-pointer inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] font-medium select-none"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      <Icon.Quote size={11} />
                      Read the actual contract language
                      <Icon.ChevronDown
                        size={11}
                        className="group-open:rotate-180 transition"
                      />
                    </summary>
                    <blockquote
                      className="mt-3 pl-4 py-1 text-[13px] leading-[1.7] italic"
                      style={{ color: 'var(--ink-2)', borderLeft: '2px solid var(--line)' }}
                    >
                      &quot;{clause.raw}&quot;
                    </blockquote>
                  </details>
                </div>
              </>
            )}

            <div className="md:col-span-12 rounded-lg p-4" style={{ background: 'var(--primary-2)' }}>
              <p
                className="text-[11px] uppercase tracking-[0.14em] font-medium mb-2 flex items-center gap-1.5"
                style={{ color: 'var(--primary)' }}
              >
                <Icon.Lightbulb size={11} /> {readOnly ? 'What we recommended' : 'What to do'}
              </p>
              <p className="text-[14px] leading-[1.6]" style={{ color: 'var(--ink)' }}>
                {renderWithGlossary(clause.action)}
              </p>
              {clause.suggestion && (
                <div
                  className="mt-3 pt-3 border-t font-mono text-[12px] leading-relaxed"
                  style={{
                    color: 'var(--ink-2)',
                    borderColor: 'color-mix(in oklch, var(--primary) 18%, transparent)',
                  }}
                >
                  <span
                    className="not-italic font-sans text-[10px] uppercase tracking-[0.12em] block mb-1.5"
                    style={{ color: 'var(--primary)' }}
                  >
                    Suggested redline
                  </span>
                  {clause.suggestion}
                </div>
              )}
            </div>

            {note != null && (
              <div className="md:col-span-12">
                <NoteBox value={note} onChange={(v) => setNote(v)} />
              </div>
            )}

            <div className="md:col-span-12">
              <CommentThread thread={thread} onAdd={addComment} />
            </div>

            {!readOnly && (
              <div className="md:col-span-12 flex items-center justify-between gap-2 flex-wrap pt-1">
                <TriageActions current={triage} onChange={setTriage} />
                <button
                  className="text-xs underline-offset-2 hover:underline inline-flex items-center gap-1"
                  style={{ color: 'var(--ink-3)' }}
                  onClick={() => setNote(note != null ? null : '')}
                >
                  {note != null ? 'Discard note' : '+ Add a note'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function TriageBadge({ triage }: { triage: TriageDecision }) {
  const map = {
    accept: { label: 'Accepted', color: 'var(--low)', bg: 'var(--low-bg)', icon: 'ThumbsUp' },
    negotiate: { label: 'Negotiating', color: 'var(--high)', bg: 'var(--high-bg)', icon: 'Pen' },
    decline: {
      label: 'Declined',
      color: 'var(--critical)',
      bg: 'var(--critical-bg)',
      icon: 'ThumbsDown',
    },
  } as const
  const m = map[triage]
  if (!m) return null
  const IconCmp = Icon[m.icon]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
      style={{ background: m.bg, color: m.color }}
    >
      <IconCmp size={10} /> {m.label}
    </span>
  )
}

function TriageActions({
  current,
  onChange,
}: {
  current: TriageDecision | null
  onChange: (v: TriageDecision | null) => void
}) {
  const actions = [
    { key: 'accept', label: 'Accept', icon: Icon.ThumbsUp, color: 'var(--low)' },
    { key: 'negotiate', label: 'Negotiate', icon: Icon.Pen, color: 'var(--high)' },
    { key: 'decline', label: 'Decline', icon: Icon.ThumbsDown, color: 'var(--critical)' },
  ] as const
  return (
    <div
      className="inline-flex items-center gap-1.5 p-1 rounded-md"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
    >
      {actions.map((a) => {
        const active = current === a.key
        return (
          <button
            key={a.key}
            onClick={() => onChange(active ? null : a.key)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition"
            style={
              active
                ? { background: 'var(--surface)', color: a.color, boxShadow: 'var(--shadow-sm)' }
                : { color: 'var(--ink-2)' }
            }
          >
            <a.icon size={12} />
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

function NoteBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: 'var(--accent-2)',
        border: '1px solid color-mix(in oklch, var(--accent) 22%, transparent)',
      }}
    >
      <p
        className="text-[10px] uppercase tracking-[0.14em] font-medium mb-1.5 flex items-center gap-1.5"
        style={{ color: 'var(--accent)' }}
      >
        <Icon.Pen size={10} /> Your note
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Something to remember when you bring this to a lawyer or the counterparty…"
        className="w-full bg-transparent text-[13px] leading-[1.5] resize-none outline-none placeholder:opacity-50"
        style={{ color: 'var(--ink)' }}
      />
    </div>
  )
}

function CommentThread({
  thread,
  onAdd,
}: {
  thread: CgComment[]
  onAdd: (text: string) => void
}) {
  const [draft, setDraft] = React.useState('')
  const [expanded, setExpanded] = React.useState(false)

  function submit(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
    setExpanded(false)
  }

  if (thread.length === 0 && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 text-xs hover:underline underline-offset-2"
        style={{ color: 'var(--ink-3)' }}
      >
        <Icon.Quote size={11} /> Start a thread on this clause
      </button>
    )
  }

  return (
    <div
      className="rounded-lg"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
    >
      <p
        className="text-[10px] uppercase tracking-[0.14em] font-medium px-3.5 pt-3 flex items-center gap-1.5"
        style={{ color: 'var(--ink-3)' }}
      >
        <Icon.Quote size={10} /> Thread · {thread.length}{' '}
        {thread.length === 1 ? 'comment' : 'comments'}
      </p>
      <ul className="px-3.5 pt-2.5 pb-2 space-y-3.5">
        {thread.map((c) => (
          <li key={c.id} className="flex gap-3 items-start">
            <Avatar name={c.author} size={26} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
                  {c.author}
                </span>
                {c.role && (
                  <span
                    className="text-[10px] uppercase tracking-[0.14em] font-medium"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {c.role}
                  </span>
                )}
                <span
                  className="text-[10.5px] font-mono ml-auto"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {relativeTime(c.ts)}
                </span>
              </div>
              <p
                className="text-[13px] leading-[1.55] mt-0.5"
                style={{ color: 'var(--ink-2)' }}
              >
                {c.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <form
        onSubmit={submit}
        className="px-3.5 pb-3 pt-1.5 flex items-end gap-2 border-t"
        style={{ borderColor: 'var(--line)' }}
      >
        <Avatar name="You" size={24} />
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={1}
          placeholder={thread.length === 0 ? 'Start the thread…' : 'Reply…'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e)
          }}
          className="flex-1 bg-transparent text-[13px] leading-[1.5] resize-none outline-none placeholder:opacity-60 pt-1"
          style={{ color: 'var(--ink)', maxHeight: 80 }}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="grid place-items-center w-7 h-7 rounded-md transition disabled:opacity-30"
          style={{ background: 'var(--primary)', color: 'white' }}
          aria-label="Send comment"
        >
          <Icon.ArrowRight size={12} />
        </button>
      </form>
    </div>
  )
}

function ClauseMinimap({
  clauses,
  triageState,
  comments,
  activeId,
  setActiveId,
}: {
  clauses: CgClause[]
  triageState: TriageMap
  comments: CommentsMap
  activeId: string | null
  setActiveId: (id: string | null) => void
}) {
  if (!clauses || clauses.length === 0) return null
  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-center justify-between mb-2.5 px-1">
        <p
          className="text-[11px] uppercase tracking-[0.16em] font-medium"
          style={{ color: 'var(--ink-3)' }}
        >
          Clauses
        </p>
        <span className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
          {clauses.length}
        </span>
      </div>
      <ul className="space-y-px">
        {clauses.map((cl, i) => {
          const sev = SEV_COLOR[cl.severity]
          const triage = triageState[cl.id]
          const isActive = activeId === cl.id
          const commentCount = (comments?.[cl.id] ?? []).length
          const triageDot =
            triage === 'accept'
              ? 'var(--low)'
              : triage === 'negotiate'
                ? 'var(--high)'
                : triage === 'decline'
                  ? 'var(--critical)'
                  : null
          return (
            <li key={cl.id}>
              <button
                onClick={() => {
                  setActiveId(cl.id)
                  scrollClauseIntoView(cl.id)
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition"
                style={isActive ? { background: 'var(--surface-2)' } : {}}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background =
                      'color-mix(in oklch, var(--surface-2) 50%, transparent)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span
                  className="w-1 h-7 rounded-full shrink-0"
                  style={{ background: sev.fg }}
                />
                <span
                  className="font-mono text-[10px] tabular-nums shrink-0 w-5"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="text-[12px] truncate flex-1"
                  style={{
                    color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {cl.title.split(/[—,–]/)[0].trim()}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {commentCount > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 font-mono text-[10px]"
                      style={{ color: 'var(--ink-3)' }}
                      title={`${commentCount} comment${commentCount === 1 ? '' : 's'}`}
                    >
                      <Icon.Quote size={9} /> {commentCount}
                    </span>
                  )}
                  {triageDot && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: triageDot }}
                      title={triage ?? undefined}
                    />
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function DetailSidebar({
  contract,
  triageState,
  comments,
  activeId,
  setActiveId,
  onGenerateCounter,
  readOnly,
}: {
  contract: CgContract
  triageState: TriageMap
  comments: CommentsMap
  activeId: string | null
  setActiveId: (id: string | null) => void
  onGenerateCounter: () => void
  readOnly: boolean
}) {
  const decided = Object.values(triageState).filter((v) => v).length
  const total = contract.clauses.length
  const pct = total ? Math.round((decided / total) * 100) : 0
  const negotiables = contract.clauses.filter(
    (c) => triageState[c.id] === 'negotiate' || triageState[c.id] === 'decline',
  ).length

  return (
    <div className="lg:sticky lg:top-20 space-y-5">
      <ClauseMinimap
        clauses={contract.clauses}
        triageState={triageState}
        comments={comments}
        activeId={activeId}
        setActiveId={setActiveId}
      />

      {readOnly ? (
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--low-bg)',
            border: '1px solid color-mix(in oklch, var(--low) 25%, transparent)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="grid place-items-center w-6 h-6 rounded-full"
              style={{ background: 'var(--low)', color: 'white' }}
            >
              <Icon.Check size={11} />
            </span>
            <p
              className="text-[11px] uppercase tracking-[0.16em] font-medium"
              style={{ color: 'var(--low)' }}
            >
              Review complete
            </p>
          </div>
          <p className="text-[13px] leading-snug" style={{ color: 'var(--ink-2)' }}>
            This contract has been signed. All clauses are read-only.
          </p>
          {contract.signedAt && (
            <p className="text-[11.5px] mt-2 font-mono" style={{ color: 'var(--ink-3)' }}>
              Signed {formatDate(contract.signedAt)}
            </p>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <p
              className="text-[11px] uppercase tracking-[0.16em] font-medium"
              style={{ color: 'var(--ink-3)' }}
            >
              Your review
            </p>
            <span className="font-mono text-xs" style={{ color: 'var(--ink-2)' }}>
              {decided}/{total}
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--line-2)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: 'var(--primary)' }}
            />
          </div>
          <p className="text-[13px] mt-3 leading-snug" style={{ color: 'var(--ink-2)' }}>
            {decided === 0
              ? 'Go through each clause and decide: accept, negotiate, or decline.'
              : decided === total
                ? 'All clauses decided. Ready to send your asks to the counterparty.'
                : `${total - decided} clauses left to decide on.`}
          </p>
          {decided > 0 && (
            <Btn
              variant="primary"
              size="sm"
              icon={Icon.Send}
              onClick={onGenerateCounter}
              className="mt-4 w-full"
              style={{ justifyContent: 'center' }}
              disabled={negotiables === 0}
            >
              {negotiables === 0
                ? 'Mark something to negotiate'
                : `Draft counter-proposal (${negotiables})`}
            </Btn>
          )}
        </div>
      )}

      {contract.deadlines && contract.deadlines.length > 0 && (
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.16em] font-medium mb-4"
            style={{ color: 'var(--ink-3)' }}
          >
            Calendar
          </p>
          <DeadlineTimeline deadlines={contract.deadlines} />
        </div>
      )}

      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <p
          className="text-[11px] uppercase tracking-[0.16em] font-medium mb-3"
          style={{ color: 'var(--ink-3)' }}
        >
          Counterparty
        </p>
        <div className="flex items-center gap-3">
          <Avatar name={contract.counterparty} size={40} />
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {contract.counterparty}
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
              First contract on file
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4 flex gap-3" style={{ background: 'var(--surface-2)' }}>
        <Icon.Lightbulb
          size={14}
          className="shrink-0 mt-0.5"
          style={{ color: 'var(--ink-3)' }}
        />
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          ClauseGardian summarizes contracts for you — but it isn&apos;t your lawyer. For anything
          you&apos;re not sure about, share with a real attorney before signing.
        </p>
      </div>
    </div>
  )
}

function DeadlineTimeline({ deadlines }: { deadlines: CgContract['deadlines'] }) {
  const sorted = [...deadlines].sort((a, b) => +new Date(a.date) - +new Date(b.date))
  return (
    <ol className="relative space-y-4">
      <span
        className="absolute left-[7px] top-2 bottom-2 w-px"
        style={{ background: 'var(--line)' }}
      />
      {sorted.map((d) => {
        const days = daysUntil(d.date)
        const urgent = days != null && days <= 14
        const past = days != null && days < 0
        return (
          <li key={d.id} className="relative pl-7">
            <span
              className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full grid place-items-center"
              style={{
                background: 'var(--surface)',
                border: `2px solid ${
                  past ? 'var(--ink-3)' : urgent ? 'var(--critical)' : 'var(--primary)'
                }`,
              }}
            >
              {past && <Icon.Check size={7} />}
            </span>
            <p
              className="font-mono text-[11px]"
              style={{ color: urgent ? 'var(--critical)' : 'var(--ink-3)' }}
            >
              {formatDate(d.date, { short: true })}{' '}
              {days != null && days >= 0 && <span className="opacity-70">· in {days}d</span>}
            </p>
            <p className="text-[13px] leading-snug mt-0.5" style={{ color: 'var(--ink)' }}>
              {d.label}
            </p>
            {d.note && (
              <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--ink-3)' }}>
                {d.note}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function AnalyzingState({
  contract,
  onBack,
}: {
  contract: CgContract
  onBack: () => void
}) {
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1200)
    return () => clearInterval(i)
  }, [])
  const progress = 30 + ((tick * 7) % 50)

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
      <DetailHeader contract={contract} onBack={onBack} />
      <main
        className="max-w-[800px] mx-auto px-6 md:px-10 pt-16 pb-24 text-center relative"
        style={{ zIndex: 1 }}
      >
        <div className="relative w-32 h-40 mx-auto">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-md transition-transform"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                boxShadow: i === 0 ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                transform: `translate(${i * 4}px, ${i * 4}px) rotate(${(i - 1) * 1.5}deg)`,
                zIndex: 3 - i,
                opacity: 1 - i * 0.15,
              }}
            >
              <div className="p-3 space-y-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((li) => (
                  <div
                    key={li}
                    className="h-1.5 rounded-full shimmer"
                    style={{ width: `${50 + ((li * 37 + i * 11) % 50)}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p
          className="text-[11px] uppercase tracking-[0.16em] font-medium mt-12"
          style={{ color: 'var(--accent)' }}
        >
          Still reading
        </p>
        <h2
          className="font-display text-[36px] leading-[1.18] mt-2"
          style={{ color: 'var(--ink)' }}
        >
          Working through your {contract.pages > 0 ? `${contract.pages}-page ` : ''}document.
        </h2>
        <p
          className="text-[15px] leading-[1.6] mt-5 max-w-md mx-auto"
          style={{ color: 'var(--ink-2)' }}
        >
          We&apos;ll highlight every clause that could affect you, in plain English. This usually
          takes 30–60 seconds.
        </p>

        <div
          className="mt-8 max-w-sm mx-auto h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--line-2)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, background: 'var(--accent)' }}
          />
        </div>
        <p className="font-mono text-xs mt-3" style={{ color: 'var(--ink-3)' }}>
          {tick < 2
            ? 'Extracting text…'
            : tick < 5
              ? 'Spotting risky clauses…'
              : tick < 8
                ? 'Writing plain-English summaries…'
                : 'Almost done…'}
        </p>
      </main>
    </div>
  )
}

export function FailedState({
  contract,
  onBack,
}: {
  contract: CgContract
  onBack: () => void
}) {
  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
      <DetailHeader contract={contract} onBack={onBack} />
      <main
        className="max-w-[760px] mx-auto px-6 md:px-10 pt-16 pb-24 text-center relative"
        style={{ zIndex: 1 }}
      >
        <div className="relative w-32 h-40 mx-auto">
          <div
            className="absolute inset-0 rounded-md"
            style={{
              background: 'var(--surface)',
              border: '1px dashed var(--critical)',
              transform: 'rotate(-3deg)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div className="p-3 space-y-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((li) => (
                <div
                  key={li}
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${30 + ((li * 23) % 60)}%`,
                    background: 'var(--critical-bg)',
                  }}
                />
              ))}
            </div>
            <div className="absolute inset-0 grid place-items-center">
              <span
                className="grid place-items-center w-12 h-12 rounded-full"
                style={{
                  background: 'var(--critical)',
                  color: 'white',
                  boxShadow: '0 4px 12px color-mix(in oklch, var(--critical) 40%, transparent)',
                }}
              >
                <Icon.AlertCircle size={22} />
              </span>
            </div>
          </div>
        </div>

        <p
          className="text-[11px] uppercase tracking-[0.16em] font-medium mt-12"
          style={{ color: 'var(--critical)' }}
        >
          This one stumped us
        </p>
        <h2
          className="font-display text-[36px] leading-[1.18] mt-2"
          style={{ color: 'var(--ink)' }}
        >
          We couldn&apos;t read this document.
        </h2>
        <p
          className="text-[15px] leading-[1.6] mt-3 max-w-md mx-auto"
          style={{ color: 'var(--ink-2)' }}
        >
          {contract.failReason}
        </p>

        <div className="mt-7 flex items-center justify-center gap-2">
          <Btn variant="soft" onClick={onBack}>
            Back to garden
          </Btn>
          <Btn variant="primary" icon={Icon.Upload} onClick={onBack}>
            Upload a different file
          </Btn>
        </div>

        <details className="mt-10 inline-block text-left max-w-md mx-auto">
          <summary
            className="cursor-pointer text-xs font-medium"
            style={{ color: 'var(--ink-3)' }}
          >
            What we tried
          </summary>
          <ul
            className="mt-3 text-[12px] space-y-1.5 list-none"
            style={{ color: 'var(--ink-3)' }}
          >
            <li>✓ Detected PDF format</li>
            <li>✓ Opened the file</li>
            <li>× Found 0 characters of selectable text</li>
            <li>× OCR fallback isn&apos;t enabled on your plan</li>
          </ul>
        </details>
      </main>
    </div>
  )
}
