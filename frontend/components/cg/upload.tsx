'use client'

// components/cg/upload.tsx — upload modal (wired to the real backend) + ⌘K palette.
import * as React from 'react'
import { Icon } from './icons'
import { Avatar, Btn, Kbd, Leaf, StatusChip, VerdictPill } from './primitives'
import type { CgContract } from '@/lib/cg/data'

type Step = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'failed'

export function UploadModal({
  onClose,
  onComplete,
  uploadFile,
}: {
  onClose: () => void
  onComplete?: () => void
  // Performs the real upload against the backend; resolves when accepted.
  uploadFile: (file: File) => Promise<void>
}) {
  const [step, setStep] = React.useState<Step>('idle')
  const [filename, setFilename] = React.useState<string | null>(null)
  const [drag, setDrag] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === 'Escape' &&
        (step === 'idle' || step === 'complete' || step === 'failed')
      )
        onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, onClose])

  function pick() {
    fileRef.current?.click()
  }

  async function start(file?: File | null) {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setError('File is bigger than 20 MB.')
      return
    }
    setFilename(file.name)
    setError(null)
    setStep('uploading')
    try {
      await uploadFile(file)
      setStep('analyzing')
      setTimeout(() => setStep('complete'), 1400)
      setTimeout(() => {
        onComplete?.()
        onClose()
      }, 2600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
      setStep('failed')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: 'color-mix(in oklch, var(--ink) 50%, transparent)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] rounded-2xl overflow-hidden anim-fade-up"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          boxShadow: '0 24px 80px rgba(40,30,10,0.25)',
        }}
      >
        {(step === 'idle' || step === 'failed') && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-md hover:bg-black/5 transition"
            style={{ color: 'var(--ink-3)' }}
          >
            <Icon.X size={16} />
          </button>
        )}

        {step === 'idle' && (
          <div className="p-7">
            <p
              className="text-[11px] uppercase tracking-[0.16em] font-medium"
              style={{ color: 'var(--ink-3)' }}
            >
              Plant a contract
            </p>
            <h2
              className="font-display text-[28px] leading-[1.22] mt-1.5"
              style={{ color: 'var(--ink)' }}
            >
              Drop it here. We&apos;ll read it for you.
            </h2>

            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                start(e.dataTransfer.files[0])
              }}
              onClick={pick}
              className="mt-5 cursor-pointer block rounded-xl p-8 text-center transition"
              style={{
                background: drag ? 'var(--primary-2)' : 'var(--surface-2)',
                border: `1.5px dashed ${drag ? 'var(--primary)' : 'var(--line)'}`,
              }}
            >
              <Icon.Upload
                size={28}
                style={{ color: drag ? 'var(--primary)' : 'var(--ink-3)' }}
                className="mx-auto"
              />
              <p className="mt-3 text-sm" style={{ color: 'var(--ink-2)' }}>
                Drag a PDF or DOCX here, or{' '}
                <span style={{ color: 'var(--primary)', fontWeight: 500 }}>browse files</span>.
              </p>
              <p className="text-xs mt-1.5 font-mono" style={{ color: 'var(--ink-3)' }}>
                up to 20 MB
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => start(e.target.files?.[0])}
              />
            </label>

            {error && (
              <p className="mt-3 text-sm" style={{ color: 'var(--critical)' }}>
                {error}
              </p>
            )}

            <div
              className="mt-5 flex items-start gap-2.5 rounded-lg p-3"
              style={{ background: 'var(--surface-2)' }}
            >
              <Icon.Sparkle
                size={13}
                className="shrink-0 mt-0.5"
                style={{ color: 'var(--accent)' }}
              />
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                We read it, summarize each clause in plain English, and flag what&apos;s risky.
                Usually under a minute.
              </p>
            </div>
          </div>
        )}

        {(step === 'uploading' || step === 'analyzing' || step === 'complete') && (
          <div className="p-7 text-center">
            <p
              className="text-[11px] uppercase tracking-[0.16em] font-medium"
              style={{ color: step === 'complete' ? 'var(--low)' : 'var(--accent)' }}
            >
              {step === 'uploading' && 'Receiving'}
              {step === 'analyzing' && 'Reading'}
              {step === 'complete' && 'Done'}
            </p>
            <h2
              className="font-display text-[24px] leading-[1.28] mt-1.5 truncate"
              style={{ color: 'var(--ink)' }}
              title={filename ?? undefined}
            >
              {filename}
            </h2>

            <div className="mt-7 flex items-center justify-between gap-2 max-w-[280px] mx-auto">
              {(
                [
                  { key: 'uploading', label: 'Upload' },
                  { key: 'analyzing', label: 'Read' },
                  { key: 'complete', label: 'Ready' },
                ] as const
              ).map((s, i, arr) => {
                const order = ['uploading', 'analyzing', 'complete']
                const idx = order.indexOf(step)
                const sidx = order.indexOf(s.key)
                const done = sidx < idx || step === 'complete'
                const active = sidx === idx && step !== 'complete'
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-7 h-7 rounded-full grid place-items-center transition"
                        style={
                          done
                            ? { background: 'var(--low)', color: 'white' }
                            : active
                              ? { background: 'var(--primary-2)', color: 'var(--primary)' }
                              : {
                                  background: 'var(--surface-2)',
                                  color: 'var(--ink-3)',
                                  border: '1px solid var(--line)',
                                }
                        }
                      >
                        {done ? (
                          <Icon.Check size={12} />
                        ) : active ? (
                          <Leaf size={11} />
                        ) : (
                          <span className="text-[10px] font-mono">{i + 1}</span>
                        )}
                      </div>
                      <span
                        className="text-[10px] font-medium uppercase tracking-wider"
                        style={{
                          color: done
                            ? 'var(--low)'
                            : active
                              ? 'var(--primary)'
                              : 'var(--ink-3)',
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <div
                        className="flex-1 h-px"
                        style={{ background: done ? 'var(--low)' : 'var(--line)' }}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </div>

            <p
              className="mt-6 text-[13px] leading-relaxed max-w-[320px] mx-auto"
              style={{ color: 'var(--ink-2)' }}
            >
              {step === 'uploading' && 'Sending your document over a private channel…'}
              {step === 'analyzing' && 'Spotting risky clauses, writing plain-English summaries.'}
              {step === 'complete' && 'Upload accepted. We&apos;ll keep reading in the background…'}
            </p>
          </div>
        )}

        {step === 'failed' && (
          <div className="p-7 text-center">
            <span
              className="inline-grid place-items-center w-12 h-12 rounded-full"
              style={{ background: 'var(--critical-bg)', color: 'var(--critical)' }}
            >
              <Icon.AlertCircle size={20} />
            </span>
            <h2
              className="font-display text-[24px] leading-[1.28] mt-3"
              style={{ color: 'var(--ink)' }}
            >
              That didn&apos;t work.
            </h2>
            <p
              className="text-[13px] leading-relaxed mt-3 max-w-[340px] mx-auto"
              style={{ color: 'var(--ink-2)' }}
            >
              {error ??
                "We couldn't read this file. It might be a scanned image without text — try a different copy."}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Btn variant="soft" onClick={onClose}>
                Close
              </Btn>
              <Btn variant="primary" icon={Icon.Upload} onClick={() => setStep('idle')}>
                Try another file
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function CommandPalette({
  open,
  onClose,
  contracts,
  onOpenContract,
}: {
  open: boolean
  onClose: () => void
  contracts: CgContract[]
  onOpenContract: (id: string) => void
}) {
  const [q, setQ] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30)
      setQ('')
    }
  }, [open])
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const ql = q.toLowerCase()
  const matches = contracts
    .filter(
      (c) =>
        !ql ||
        c.name.toLowerCase().includes(ql) ||
        (c.counterparty ?? '').toLowerCase().includes(ql) ||
        (c.kind ?? '').toLowerCase().includes(ql),
    )
    .slice(0, 6)

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start p-4 pt-[12vh]"
      style={{ background: 'color-mix(in oklch, var(--ink) 35%, transparent)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[560px] rounded-xl overflow-hidden anim-fade-up"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          boxShadow: '0 16px 60px rgba(40,30,10,0.25)',
        }}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'var(--line)' }}
        >
          <Icon.Search size={15} style={{ color: 'var(--ink-3)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search contracts, counterparties, deadlines…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:opacity-60"
            style={{ color: 'var(--ink)' }}
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="py-2 max-h-[50vh] overflow-y-auto scroll-thin">
          {matches.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm" style={{ color: 'var(--ink-3)' }}>
              No matches.
            </li>
          ) : (
            matches.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    onOpenContract(c.id)
                    onClose()
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-black/5 transition"
                >
                  <Avatar name={c.counterparty ?? c.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--ink)' }}
                    >
                      {c.counterparty ?? c.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>
                      {c.kind ?? c.name}
                    </p>
                  </div>
                  {c.status === 'complete' ? (
                    <VerdictPill verdict={c.verdict} />
                  ) : (
                    <StatusChip status={c.status} />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
