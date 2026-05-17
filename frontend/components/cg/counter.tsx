'use client'

// components/cg/counter.tsx — counter-proposal modal: review redlines → format → send.
import * as React from 'react'
import { Icon } from './icons'
import { Btn, Leaf } from './primitives'
import type { CgContract, TriageDecision } from '@/lib/cg/data'

type TriageMap = Record<string, TriageDecision | null | undefined>
type NotesMap = Record<string, string | null | undefined>

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

export function CounterProposalModal({
  open,
  onClose,
  contract,
  triageState,
  notes,
}: {
  open: boolean
  onClose: () => void
  contract: CgContract | undefined
  triageState: TriageMap
  notes: NotesMap
}) {
  const [step, setStep] = React.useState<'review' | 'formatting' | 'sent'>('review')
  const [tone, setTone] = React.useState<'friendly' | 'direct'>('friendly')

  React.useEffect(() => {
    if (open) {
      setStep('review')
      setTone('friendly')
    }
  }, [open])

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && step !== 'formatting') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, onClose])

  if (!open || !contract) return null

  const issues = contract.clauses
    .filter((cl) => triageState[cl.id] === 'negotiate' || triageState[cl.id] === 'decline')
    .map((cl) => ({ ...cl, decision: triageState[cl.id]!, note: notes[cl.id] }))

  const acceptedCount = contract.clauses.filter((cl) => triageState[cl.id] === 'accept').length

  function send() {
    setStep('formatting')
    setTimeout(() => setStep('sent'), 1600)
    setTimeout(() => onClose(), 4200)
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 overflow-y-auto"
      style={{ background: 'color-mix(in oklch, var(--ink) 50%, transparent)' }}
      onClick={() => step !== 'formatting' && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[640px] rounded-2xl overflow-hidden anim-fade-up my-8"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          boxShadow: '0 24px 80px rgba(40,30,10,0.25)',
        }}
      >
        {step !== 'formatting' && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-md hover:bg-black/5 transition z-10"
            style={{ color: 'var(--ink-3)' }}
          >
            <Icon.X size={16} />
          </button>
        )}

        {step === 'review' && (
          <div className="flex flex-col max-h-[80vh]">
            <header
              className="px-7 pt-7 pb-5 border-b"
              style={{ borderColor: 'var(--line)' }}
            >
              <p
                className="text-[11px] uppercase tracking-[0.16em] font-medium"
                style={{ color: 'var(--primary)' }}
              >
                Counter-proposal
              </p>
              <h2
                className="font-display text-[26px] leading-[1.22] mt-1.5"
                style={{ color: 'var(--ink)' }}
              >
                Your asks for <em>{contract.counterparty}</em>
              </h2>
              <p
                className="text-[13px] leading-relaxed mt-2"
                style={{ color: 'var(--ink-2)' }}
              >
                We&apos;ll wrap your redlines in a polite email you can send straight to them, or
                copy into your own.
              </p>
            </header>

            <div className="px-7 py-5 overflow-y-auto scroll-thin flex-1">
              {issues.length === 0 ? (
                <div className="py-6 text-center">
                  <Icon.AlertCircle
                    size={20}
                    className="mx-auto mb-2"
                    style={{ color: 'var(--ink-3)' }}
                  />
                  <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                    You haven&apos;t marked any clauses as <em>Negotiate</em> or{' '}
                    <em>Decline</em> yet.
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
                    Tag at least one clause to generate a counter-proposal.
                  </p>
                </div>
              ) : (
                <>
                  <p
                    className="text-[11px] uppercase tracking-[0.14em] font-medium mb-3"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {issues.length} ask{issues.length === 1 ? '' : 's'} · {acceptedCount} clause
                    {acceptedCount === 1 ? '' : 's'} accepted as-is
                  </p>
                  <ol className="space-y-3">
                    {issues.map((it, i) => {
                      const isDecline = it.decision === 'decline'
                      return (
                        <li
                          key={it.id}
                          className="rounded-lg p-4"
                          style={{
                            background: 'var(--surface-2)',
                            border: '1px solid var(--line)',
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="num-circle shrink-0"
                              style={{
                                background: isDecline
                                  ? 'var(--critical-bg)'
                                  : 'var(--high-bg)',
                                color: isDecline ? 'var(--critical)' : 'var(--high)',
                              }}
                            >
                              {String(i + 1).padStart(2, '0')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <TriageBadge triage={it.decision} />
                                {it.page != null && (
                                  <span
                                    className="text-[11px] font-mono"
                                    style={{ color: 'var(--ink-3)' }}
                                  >
                                    p.{it.page}
                                  </span>
                                )}
                              </div>
                              <p
                                className="text-[14px] font-medium leading-snug"
                                style={{ color: 'var(--ink)' }}
                              >
                                {it.title}
                              </p>
                              {!isDecline && it.suggestion && (
                                <div
                                  className="mt-2.5 font-mono text-[11.5px] leading-relaxed rounded p-2.5"
                                  style={{
                                    color: 'var(--ink-2)',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--line)',
                                  }}
                                >
                                  <span
                                    className="not-italic font-sans text-[10px] uppercase tracking-[0.12em] block mb-1"
                                    style={{ color: 'var(--primary)' }}
                                  >
                                    Proposed language
                                  </span>
                                  {it.suggestion}
                                </div>
                              )}
                              {isDecline && (
                                <p
                                  className="text-[12px] leading-relaxed mt-2"
                                  style={{ color: 'var(--critical)' }}
                                >
                                  We&apos;ll ask them to strike this clause entirely.
                                </p>
                              )}
                              {it.note && (
                                <div
                                  className="mt-2 text-[11.5px] leading-relaxed italic"
                                  style={{ color: 'var(--ink-3)' }}
                                >
                                  Your note: &quot;{it.note}&quot;
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </>
              )}
            </div>

            <footer
              className="px-7 py-4 border-t flex items-center gap-3 flex-wrap"
              style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
            >
              <div className="flex items-center gap-2 mr-auto">
                <span
                  className="text-[11px] uppercase tracking-[0.14em] font-medium"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Tone
                </span>
                <div
                  className="flex p-0.5 rounded-md"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                >
                  {(
                    [
                      { key: 'friendly', label: 'Friendly' },
                      { key: 'direct', label: 'Direct' },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.key}
                      onClick={() => setTone(o.key)}
                      className="px-2.5 py-1 text-xs font-medium rounded transition"
                      style={
                        tone === o.key
                          ? {
                              background: 'var(--surface-2)',
                              color: 'var(--ink)',
                              boxShadow: 'var(--shadow-sm)',
                            }
                          : { color: 'var(--ink-3)' }
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <Btn variant="soft" onClick={onClose}>
                Cancel
              </Btn>
              <Btn
                variant="primary"
                icon={Icon.ArrowRight}
                disabled={issues.length === 0}
                onClick={send}
              >
                Draft email
              </Btn>
            </footer>
          </div>
        )}

        {step === 'formatting' && (
          <div className="px-7 py-12 text-center">
            <div
              className="relative inline-flex items-center justify-center w-12 h-12 rounded-full"
              style={{ background: 'var(--primary-2)' }}
            >
              <Leaf size={18} color="var(--primary)" />
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  border: '2px solid var(--primary)',
                  borderTopColor: 'transparent',
                  animation: 'spin 1.4s linear infinite',
                }}
              />
            </div>
            <h2
              className="font-display text-[22px] leading-[1.28] mt-5"
              style={{ color: 'var(--ink)' }}
            >
              Drafting your message…
            </h2>
            <p
              className="text-[13px] leading-relaxed mt-2 max-w-[340px] mx-auto"
              style={{ color: 'var(--ink-2)' }}
            >
              Wrapping your {issues.length} ask{issues.length === 1 ? '' : 's'} in a {tone} tone.
            </p>
          </div>
        )}

        {step === 'sent' && (
          <div className="flex flex-col max-h-[80vh]">
            <header
              className="px-7 pt-7 pb-5 border-b"
              style={{ borderColor: 'var(--line)' }}
            >
              <span
                className="inline-grid place-items-center w-9 h-9 rounded-full mb-3"
                style={{ background: 'var(--low-bg)', color: 'var(--low)' }}
              >
                <Icon.Check size={16} />
              </span>
              <p
                className="text-[11px] uppercase tracking-[0.16em] font-medium"
                style={{ color: 'var(--low)' }}
              >
                Draft ready
              </p>
              <h2
                className="font-display text-[26px] leading-[1.22] mt-1.5"
                style={{ color: 'var(--ink)' }}
              >
                Your reply to <em>{contract.counterparty}</em>
              </h2>
            </header>

            <div className="px-7 py-5 overflow-y-auto scroll-thin flex-1">
              <div
                className="rounded-lg p-5 text-[13.5px] leading-[1.7]"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                  fontFamily: 'Geist, ui-sans-serif',
                }}
              >
                <p>Hi {(contract.counterparty ?? 'there').split(/[, ]/)[0]} team,</p>
                <p className="mt-3">
                  Thanks for sending over the {(contract.kind ?? 'contract').toLowerCase()}. I
                  reviewed it carefully and most of it looks great — I&apos;m comfortable with{' '}
                  {acceptedCount} of the {contract.clauses.length} clauses as-written.
                </p>
                <p className="mt-3">
                  Before signing, I&apos;d like to discuss {issues.length}{' '}
                  {issues.length === 1 ? 'section' : 'sections'}:
                </p>
                <ol className="mt-2 space-y-2.5 pl-5 list-decimal">
                  {issues.map((it) => (
                    <li key={it.id}>
                      <strong>{it.title.split(/[—,–]/)[0].trim()}</strong>
                      {it.page != null ? ` (p.${it.page})` : ''} —{' '}
                      {it.decision === 'decline'
                        ? "I'd like to strike this clause entirely."
                        : it.action.split(/[.!?]/)[0].trim() + '.'}
                    </li>
                  ))}
                </ol>
                <p className="mt-3">
                  Happy to jump on a call if it&apos;s easier. Looking forward to getting this
                  signed.
                </p>
                <p className="mt-3">
                  Best,
                  <br />
                  Sam
                </p>
              </div>
            </div>

            <footer
              className="px-7 py-4 border-t flex items-center gap-3"
              style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
            >
              <div className="mr-auto">
                <p
                  className="text-[11px] uppercase tracking-[0.14em] font-medium"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Closing in 4s
                </p>
              </div>
              <Btn variant="soft" icon={Icon.FileText}>
                Copy
              </Btn>
              <Btn variant="primary" icon={Icon.Send}>
                Open in email
              </Btn>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}
