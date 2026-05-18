// lib/cg/adapt.ts — maps the real backend (lib/api.ts) onto the ClauseGuardian
// design view-model. Fields the backend doesn't track (counterparty, kind,
// verdict, plain-English titles, etc.) are derived best-effort so the redesigned
// UI renders with live data instead of mock seed contracts.

import type { Contract, Clause, Deadline } from '@/lib/api'
import type {
  CgClause,
  CgContract,
  CgDeadline,
  CgNotification,
  Severity,
  Verdict,
} from './data'
import { daysUntil } from './data'

const VERDICT_BY_RISK: Record<string, Verdict> = {
  critical: 'decline',
  high: 'negotiate',
  medium: 'sign-with-edits',
  low: 'sign',
}

const VERDICT_NOTE: Record<Verdict, string> = {
  sign: 'Clean and fair. Nothing here should stop you from signing as-is.',
  'sign-with-edits':
    'Reasonable overall — a couple of clauses are worth tightening before you sign.',
  negotiate:
    "There are clauses here that would meaningfully hurt you if things go sideways. Worth pushing back before you sign.",
  decline:
    "We'd hold off. Several clauses need to be rewritten before this is safe to sign.",
}

export function humanizeType(t: string | null | undefined): string {
  if (!t) return 'Clause'
  return t
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function stripExt(name: string): string {
  return name.replace(/\.[^./\\]+$/, '')
}

/** Best-effort counterparty: "Acme — MSA.pdf" → "Acme". */
export function deriveCounterparty(name: string): string {
  const base = stripExt(name).trim()
  const parts = base.split(/\s[—–-]\s/)
  return (parts.length > 1 ? parts[0] : base).trim() || base
}

/** Best-effort document kind from the filename's right-hand side. */
export function deriveKind(name: string): string {
  const base = stripExt(name).trim()
  const parts = base.split(/\s[—–-]\s/)
  if (parts.length > 1) return parts.slice(1).join(' — ').trim()
  return 'Contract'
}

export function adaptClause(cl: Clause): CgClause {
  const human = humanizeType(cl.clause_type)
  return {
    id: cl.id,
    type: cl.clause_type,
    severity: cl.severity,
    page: cl.page_ref,
    title: cl.summary?.split(/(?<=[.!?])\s/)[0]?.trim() || human,
    plain: cl.summary ?? 'No plain-English summary was generated for this clause.',
    raw: cl.raw_text ?? '',
    action: cl.recommended_action ?? 'No specific action recommended.',
  }
}

const URGENCY_BY_DAYS = (d: number | null): Severity => {
  if (d == null) return 'low'
  if (d <= 7) return 'critical'
  if (d <= 21) return 'high'
  if (d <= 45) return 'medium'
  return 'low'
}

export function adaptDeadline(d: Deadline): CgDeadline {
  return {
    id: d.id,
    date: d.deadline_date,
    label: 'Deadline',
    urgency: URGENCY_BY_DAYS(daysUntil(d.deadline_date)),
    note: d.alert_window ? `${d.alert_window} reminder window` : undefined,
  }
}

export function adaptContract(
  c: Contract,
  clauses: Clause[] = [],
  deadlines: Deadline[] = [],
): CgContract {
  const cgClauses = clauses.map(adaptClause)
  const counts = {
    critical: cgClauses.filter((x) => x.severity === 'critical').length,
    high: cgClauses.filter((x) => x.severity === 'high').length,
    medium: cgClauses.filter((x) => x.severity === 'medium').length,
    low: cgClauses.filter((x) => x.severity === 'low').length,
  }
  const verdict = c.overall_risk ? VERDICT_BY_RISK[c.overall_risk] : null
  const summary =
    c.status === 'complete'
      ? `${cgClauses.length} clause${cgClauses.length === 1 ? '' : 's'} analyzed — ` +
        `${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low.`
      : c.status === 'analyzing'
        ? null
        : null

  return {
    id: c.id,
    name: c.name,
    counterparty: deriveCounterparty(c.name),
    kind: deriveKind(c.name),
    pages: 0,
    uploadedAt: c.created_at,
    expiresAt: c.expires_at,
    status: c.status,
    lifecycle: c.status === 'complete' ? 'reviewing' : undefined,
    risk: c.overall_risk,
    verdict,
    verdictNote: verdict ? VERDICT_NOTE[verdict] : undefined,
    summary,
    failReason:
      c.status === 'failed'
        ? "We couldn't read this document. It may be a scanned image without selectable text — try a text-based PDF or run OCR first."
        : undefined,
    clauses: cgClauses,
    deadlines: deadlines.map(adaptDeadline),
  }
}

/** Derive a small, real notification feed from the user's actual contracts. */
export function deriveNotifications(contracts: CgContract[]): CgNotification[] {
  const out: CgNotification[] = []
  for (const c of contracts) {
    if (c.status === 'failed') {
      out.push({
        id: `n-fail-${c.id}`,
        icon: 'AlertCircle',
        tone: 'critical',
        title: `${c.name} couldn't be read`,
        body: 'Try a text-based PDF or run OCR first.',
        ts: c.uploadedAt,
        read: false,
        contractId: c.id,
      })
    } else if (c.status === 'analyzing' || c.status === 'processing') {
      out.push({
        id: `n-analyzing-${c.id}`,
        icon: 'CheckCircle',
        tone: 'default',
        title: `${c.counterparty ?? c.name} is being read`,
        body: 'Analysis will be ready shortly.',
        ts: c.uploadedAt,
        read: false,
        contractId: c.id,
      })
    } else if (c.risk === 'critical' || c.risk === 'high') {
      out.push({
        id: `n-risk-${c.id}`,
        icon: 'AlertTriangle',
        tone: c.risk === 'critical' ? 'critical' : 'high',
        title: `${c.counterparty ?? c.name} needs your attention`,
        body: `Flagged ${c.risk} risk. Review before signing.`,
        ts: c.uploadedAt,
        read: false,
        contractId: c.id,
      })
    }
    const d = daysUntil(c.expiresAt)
    if (d != null && d >= 0 && d <= 30) {
      out.push({
        id: `n-exp-${c.id}`,
        icon: 'Clock',
        tone: d <= 7 ? 'high' : 'default',
        title: `${c.counterparty ?? c.name} expires in ${d} day${d === 1 ? '' : 's'}`,
        body: 'Decide whether to renew, renegotiate, or let it lapse.',
        ts: c.uploadedAt,
        read: false,
        contractId: c.id,
      })
    }
  }
  return out.sort((a, b) => +new Date(b.ts) - +new Date(a.ts)).slice(0, 12)
}
