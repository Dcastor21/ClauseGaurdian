'use client'

// components/cg/assistant.tsx — "Ask ClauseGuardian" floating chat panel.
//
// The design prototype called window.claude.complete (a design-tool shim). There
// is no AI assistant endpoint on the real backend yet, so this gracefully
// degrades: it uses window.claude.complete if the host injects it, otherwise it
// surfaces the friendly error state the design already accounts for. Wiring a
// real /assistant endpoint is future backend work.
import * as React from 'react'
import { Icon } from './icons'
import { Kbd, Leaf } from './primitives'
import { VERDICT_STYLE } from './primitives'
import type { CgContract } from '@/lib/cg/data'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

declare global {
  interface Window {
    claude?: {
      complete: (args: { system: string; messages: { role: string; content: string }[] }) => Promise<string>
    }
  }
}

export function AskAssistant({
  contract,
  open,
  onOpen,
  onClose,
}: {
  contract: CgContract
  open: boolean
  onOpen: () => void
  onClose: () => void
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    setMessages([])
    setInput('')
  }, [contract.id])

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250)
  }, [open])

  React.useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [messages, busy])

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const SUGGESTIONS = [
    "What's the worst-case scenario if I sign as-is?",
    'Which clause should I push back on first?',
    'How would a lawyer describe the liability cap?',
    'What questions should I ask them on a call?',
  ]

  const SYSTEM_PROMPT = `You are ClauseGuardian, a calm and friendly contract advisor for small-business owners and solo founders. You explain legal terms in plain English. You're opinionated but never alarmist. You speak like a smart friend, not a lawyer.

You ALWAYS remind users (briefly, once per conversation) that you're not a substitute for a real attorney for important decisions.

Here is the contract being discussed:

Title: ${contract.name}
Counterparty: ${contract.counterparty}
Kind: ${contract.kind}
Our verdict: ${contract.verdict ? VERDICT_STYLE[contract.verdict].label : 'still being analyzed'}
Our take: ${contract.verdictNote ?? ''}
Summary: ${contract.summary ?? ''}

Clauses we flagged:
${(contract.clauses ?? [])
  .map(
    (c, i) =>
      `  ${i + 1}. [${c.severity.toUpperCase()}] ${c.title}\n     Plain English: ${c.plain}\n     Recommended action: ${c.action}`,
  )
  .join('\n\n')}

Keep responses SHORT (2–4 sentences usually). Use line breaks for readability. If asked about something not in the contract, say so. Never invent clauses or terms. Don't use markdown headers.`

  async function send(text: string) {
    const userMsg = text.trim()
    if (!userMsg || busy) return
    setInput('')
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setBusy(true)

    try {
      if (!window.claude?.complete) {
        throw new Error('assistant-unavailable')
      }
      const reply = await window.claude.complete({
        system: SYSTEM_PROMPT,
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      })
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            "The contract assistant isn't connected in this environment yet. In the meantime, the clause-by-clause breakdown and recommended actions on this page cover the same ground — and for anything important, loop in a real attorney.",
          error: true,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={onOpen}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full pl-4 pr-5 py-3 anim-fade-up transition hover:-translate-y-0.5"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
            boxShadow: '0 8px 24px color-mix(in oklch, var(--ink) 35%, transparent)',
          }}
        >
          <span
            className="grid place-items-center w-6 h-6 rounded-full"
            style={{ background: 'var(--primary-2)', color: 'var(--primary)' }}
          >
            <Leaf size={12} />
          </span>
          <span className="text-sm font-medium">Ask ClauseGuardian</span>
          <Kbd>?</Kbd>
        </button>
      )}

      <div
        className={`fixed inset-0 z-50 pointer-events-none transition-opacity ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          onClick={onClose}
          className={`absolute inset-0 transition-opacity ${
            open ? 'opacity-100 pointer-events-auto' : 'opacity-0'
          }`}
          style={{ background: 'color-mix(in oklch, var(--ink) 28%, transparent)' }}
        />

        <aside
          className={`absolute right-0 top-0 bottom-0 w-full max-w-[440px] flex flex-col transition-transform duration-300 pointer-events-auto ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{
            background: 'var(--surface)',
            borderLeft: '1px solid var(--line)',
            boxShadow: '-20px 0 60px rgba(40,30,10,0.15)',
          }}
        >
          <header
            className="px-5 py-4 border-b flex items-center gap-3"
            style={{ borderColor: 'var(--line)' }}
          >
            <span
              className="grid place-items-center w-8 h-8 rounded-full"
              style={{ background: 'var(--primary)', color: 'white' }}
            >
              <Leaf size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="text-[14px] font-medium leading-tight"
                style={{ color: 'var(--ink)' }}
              >
                Ask ClauseGuardian
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                About: {contract.counterparty}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid place-items-center w-8 h-8 rounded-md hover:bg-black/5 transition"
              style={{ color: 'var(--ink-3)' }}
            >
              <Icon.X size={14} />
            </button>
          </header>

          <div ref={scrollerRef} className="flex-1 overflow-y-auto scroll-thin px-5 py-5">
            {messages.length === 0 && (
              <div className="anim-fade-up">
                <p
                  className="font-display text-[26px] leading-[1.22]"
                  style={{ color: 'var(--ink)' }}
                >
                  What do you want to know?
                </p>
                <p
                  className="text-[13px] leading-relaxed mt-2"
                  style={{ color: 'var(--ink-2)' }}
                >
                  I&apos;ve read the whole document. Ask me anything about{' '}
                  <em>{contract.counterparty}</em>&apos;s {contract.kind?.toLowerCase()} — risks,
                  terms, what to push back on, what specific phrases mean.
                </p>
                <p
                  className="text-[11px] uppercase tracking-[0.14em] font-medium mt-6 mb-3"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Try asking
                </p>
                <ul className="space-y-2">
                  {SUGGESTIONS.map((s, i) => (
                    <li key={i}>
                      <button
                        onClick={() => send(s)}
                        className="w-full text-left rounded-lg px-3.5 py-2.5 text-[13px] leading-snug transition hover:opacity-90"
                        style={{
                          background: 'var(--surface-2)',
                          color: 'var(--ink)',
                          border: '1px solid var(--line)',
                        }}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {messages.map((m, i) => (
              <Message key={i} message={m} />
            ))}

            {busy && <ThinkingDots />}
          </div>

          <form
            className="border-t p-3"
            style={{ borderColor: 'var(--line)' }}
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <div
              className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                placeholder="Ask anything about this contract…"
                className="flex-1 bg-transparent outline-none resize-none text-[14px] leading-[1.5] py-1.5 placeholder:opacity-60"
                style={{ color: 'var(--ink)', maxHeight: 120 }}
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                className="grid place-items-center w-8 h-8 rounded-md transition shrink-0 disabled:opacity-30"
                style={{ background: 'var(--primary)', color: 'white' }}
                aria-label="Send"
              >
                <Icon.ArrowRight size={14} />
              </button>
            </div>
            <p
              className="text-[10.5px] mt-2 leading-snug"
              style={{ color: 'var(--ink-3)' }}
            >
              ClauseGuardian is helpful, not legal advice. For important decisions, talk to a real
              attorney.
            </p>
          </form>
        </aside>
      </div>
    </>
  )
}

function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`mb-4 anim-fade-up flex ${isUser ? 'justify-end' : ''}`}>
      <div
        className="max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-[1.55] whitespace-pre-wrap break-words"
        style={
          isUser
            ? { background: 'var(--primary)', color: 'white', borderBottomRightRadius: 6 }
            : {
                background: 'var(--surface-2)',
                color: message.error ? 'var(--critical)' : 'var(--ink)',
                borderBottomLeftRadius: 6,
                border: '1px solid var(--line)',
              }
        }
      >
        {message.content}
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <div className="mb-4 anim-fade-up flex">
      <div
        className="rounded-2xl px-4 py-3 inline-flex items-center gap-1.5"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--line)',
          borderBottomLeftRadius: 6,
        }}
      >
        <span className="cg-dot" />
        <span className="cg-dot" style={{ animationDelay: '0.15s' }} />
        <span className="cg-dot" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
  )
}
