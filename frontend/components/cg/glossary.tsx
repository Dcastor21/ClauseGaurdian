// components/cg/glossary.tsx — inline plain-English definitions for legal terms.
import * as React from 'react'

export const GLOSSARY_TERMS: Record<string, string> = {
  indemnification:
    "A promise that one party will cover the other's legal costs and damages if certain things go wrong. Watch for one-sided versions where only you owe protection.",
  indemnify:
    'Promise to cover someone else\'s legal costs and damages — see indemnification.',
  'liability cap':
    'The maximum amount of money one side can be on the hook for if they cause harm. Tiny caps (one month of fees) are bad for you.',
  'auto-renewal':
    'A clause that extends the contract automatically unless you cancel by a specific date. Easy to forget; locks you in for another full term.',
  'force majeure':
    'An "act of God" clause excusing one party from performance if war, natural disaster, or pandemic prevents it. Usually fine; check what\'s covered.',
  'governing law':
    "Which state or country's laws apply if there's a dispute. Affects where you'd have to sue and which rules apply.",
  arbitration:
    'Private dispute resolution outside the court system. Faster and cheaper, but limits your right to appeal and class action.',
  'net 15':
    'Payment is due 15 days after the invoice. Net 30 means 30 days. Shorter terms = tighter cash flow for you.',
  'net 30':
    'Payment is due 30 days after the invoice. Standard for most business-to-business contracts.',
  'ip assignment':
    'Who owns the work product (designs, code, content). "On payment" means it becomes yours when you pay; before then, the contractor owns it.',
  confidentiality:
    'What information has to stay private, for how long, and what counts as "confidential." Mutual NDAs are standard.',
  'termination for cause':
    'The right to end the contract immediately because the other side did something wrong (breach, bankruptcy).',
  'termination for convenience':
    'The right to end the contract for any reason, usually with notice. Often one-sided in favor of the bigger party.',
  'cure period':
    'How long the other side has to fix a problem before you can terminate. Standard is 10–30 days. Without one, suspension can be instant.',
  'cam charges':
    '"Common Area Maintenance" fees — your share of the building\'s operating costs in a commercial lease. Make sure they\'re capped per year.',
  'operating expenses':
    'Building costs (taxes, insurance, maintenance) the landlord passes through to tenants. Should be itemized and capped.',
  'gross negligence':
    'A serious failure to exercise reasonable care — worse than ordinary negligence. Often carved out from liability caps.',
  'material breach':
    'A breach serious enough to justify ending the contract. Vague unless the contract defines it clearly.',
  'proportionate share':
    'Your slice of a shared cost, based on how much space you occupy or service you use. Should be in the contract as a percentage.',
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function GlossaryTerm({
  term,
  children,
}: {
  term: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLSpanElement>(null)
  const definition = GLOSSARY_TERMS[term]

  React.useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!definition) return <>{children}</>

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="cursor-help underline decoration-dotted underline-offset-[3px] decoration-1 transition hover:opacity-80"
        style={{
          color: 'inherit',
          textDecorationColor: 'color-mix(in oklch, var(--primary) 55%, transparent)',
        }}
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-30 left-1/2 -translate-x-1/2 mt-2 w-[280px] rounded-lg p-3 text-[12.5px] leading-[1.55] anim-fade-up font-sans"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
            top: '100%',
          }}
        >
          <span className="block text-[10px] uppercase tracking-[0.14em] font-medium mb-1 opacity-60">
            {term}
          </span>
          {definition}
          <span
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
            style={{ background: 'var(--ink)' }}
          />
        </span>
      )}
    </span>
  )
}

// Find any glossary term inside text and wrap it; longest term first to avoid
// partial overlaps.
export function renderWithGlossary(text: string | null | undefined): React.ReactNode {
  if (!text) return text
  const terms = Object.keys(GLOSSARY_TERMS).sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`\\b(${terms.map(escapeRe).join('|')})\\b`, 'gi')
  const parts: React.ReactNode[] = []
  let lastEnd = 0
  let match: RegExpExecArray | null
  let key = 0
  pattern.lastIndex = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastEnd) parts.push(text.slice(lastEnd, match.index))
    const matchedText = match[0]
    const lookupKey = matchedText.toLowerCase()
    parts.push(
      <GlossaryTerm key={key++} term={lookupKey}>
        {matchedText}
      </GlossaryTerm>,
    )
    lastEnd = match.index + matchedText.length
  }
  if (lastEnd < text.length) parts.push(text.slice(lastEnd))
  return parts.length ? parts : text
}
