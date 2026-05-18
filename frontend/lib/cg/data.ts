// lib/cg/data.ts — ClauseGuardian design view-model: types, helpers, seed data.
// The real backend (lib/api.ts) is mapped onto these shapes by lib/cg/adapt.ts.

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Verdict = 'sign' | 'sign-with-edits' | 'negotiate' | 'decline'
export type Lifecycle =
  | 'draft'
  | 'reviewing'
  | 'negotiating'
  | 'signed'
  | 'active'
  | 'archived'
export type CgStatus = 'processing' | 'analyzing' | 'complete' | 'failed'

export interface CgClause {
  id: string
  type: string
  severity: Severity
  page: number | null
  title: string
  plain: string
  raw: string
  action: string
  suggestion?: string
}

export interface CgDeadline {
  id: string
  date: string
  label: string
  urgency: Severity
  note?: string
}

export interface CgContract {
  id: string
  name: string
  counterparty: string | null
  kind: string | null
  pages: number
  uploadedAt: string
  expiresAt: string | null
  status: CgStatus
  lifecycle?: Lifecycle
  signedAt?: string
  risk: Severity | null
  verdict: Verdict | null
  verdictNote?: string
  summary?: string | null
  failReason?: string
  clauses: CgClause[]
  deadlines: CgDeadline[]
  exposure?: number
  historical?: boolean
}

export interface CgNotification {
  id: string
  icon: string
  tone: 'critical' | 'high' | 'default'
  title: string
  body?: string
  ts: string
  read: boolean
  contractId?: string
}

export interface CgComment {
  id: string
  author: string
  role?: string
  text: string
  ts: string
}

export type TriageDecision = 'accept' | 'negotiate' | 'decline'

// ── Helpers (mirrors data.jsx) ──────────────────────────────────────────────

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export function formatDate(
  dateStr: string | null | undefined,
  opts: { short?: boolean } = {},
): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: opts.short ? undefined : 'numeric',
  })
}

export function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = (Date.now() - new Date(dateStr).getTime()) / 3600000
  if (d < 1) return 'just now'
  if (d < 24) return `${Math.round(d)}h ago`
  if (d < 24 * 7) return `${Math.round(d / 24)}d ago`
  return formatDate(dateStr, { short: true })
}

// ── Seed contracts (used by the dashboard "Load samples" demo) ──────────────

export const SEED_CONTRACTS: CgContract[] = [
  {
    id: 'c-acme-msa',
    name: 'Acme Cloud Services — Master Agreement.pdf',
    counterparty: 'Acme Cloud Services, Inc.',
    kind: 'SaaS Subscription',
    pages: 14,
    uploadedAt: '2026-05-09T10:14:00Z',
    expiresAt: '2026-06-22',
    status: 'complete',
    lifecycle: 'reviewing',
    risk: 'high',
    verdict: 'negotiate',
    verdictNote:
      'Two clauses would meaningfully hurt you if things go sideways. Easy asks to push back on before signing.',
    summary:
      "A standard SaaS contract from Acme. You're signing up for $1,200/mo for one year, with automatic renewal. Most of it is fine — the parts that bite are auto-renewal, broad indemnification, and a low liability cap.",
    clauses: [
      {
        id: 'cl-1',
        type: 'auto_renewal',
        severity: 'critical',
        page: 3,
        title: 'Auto-renews for a full year unless you cancel 60 days early',
        plain:
          "If you forget to cancel by April 22, 2027, you're locked in for another 12 months at whatever new price they want to charge.",
        raw: 'This Agreement shall automatically renew for successive twelve (12) month periods unless either party provides written notice of non-renewal at least sixty (60) days prior to the end of the then-current term.',
        action:
          'Set a calendar reminder for April 1, 2027. Better: ask them to change this to a 30-day notice window and require a separate signature for renewal.',
        suggestion:
          'Try: "Renewal shall require affirmative written consent of Customer; no automatic renewal."',
      },
      {
        id: 'cl-2',
        type: 'liability_cap',
        severity: 'critical',
        page: 8,
        title: 'If Acme messes up badly, you can only recover $1,200 — one month of fees',
        plain:
          "Their liability is capped at one month of what you pay them. If they leak your customer data or cause a major outage, that's the most you'd ever get back.",
        raw: 'In no event shall the total cumulative liability of Provider exceed one (1) month of fees paid by Customer in the twelve (12) months preceding the event giving rise to such liability.',
        action:
          'Ask for 12 months of fees as the cap, and carve out data breaches and gross negligence so they\'re uncapped.',
        suggestion:
          'Try: "...exceed fees paid in the preceding twelve (12) months, except for breach of confidentiality, data breaches, or gross negligence, which shall not be capped."',
      },
      {
        id: 'cl-3',
        type: 'indemnification',
        severity: 'high',
        page: 9,
        title: "You promise to cover Acme's legal bills for almost anything related to your use",
        plain:
          "You agree to pay Acme back if anyone sues them over how you use the service. That's broader than industry standard — it usually only covers things you did wrong, not anything ever.",
        raw: "Customer shall indemnify, defend, and hold harmless Provider from and against any and all claims, damages, losses, costs and expenses (including reasonable attorneys' fees) arising out of or in any way related to Customer's use of the Service.",
        action:
          'Narrow the trigger to things you actually caused — your breach of the agreement or your IP infringement. Mutual indemnification is fair.',
        suggestion:
          "Try: \"...arising out of Customer's breach of this Agreement or Customer's infringement of third-party intellectual property rights.\"",
      },
      {
        id: 'cl-4',
        type: 'governing_law',
        severity: 'medium',
        page: 11,
        title: 'Any dispute has to be settled in Delaware, in front of a private arbitrator',
        plain:
          'If you ever need to sue, you have to fly to Wilmington, Delaware and use a private arbitrator. No class actions. This is annoying but standard.',
        raw: 'This Agreement shall be governed by the laws of the State of Delaware. Any dispute shall be resolved by binding arbitration in Wilmington, Delaware, administered by JAMS.',
        action:
          'Acceptable for a small-dollar contract. If you have leverage, ask for arbitration in your own state.',
      },
      {
        id: 'cl-5',
        type: 'termination',
        severity: 'medium',
        page: 6,
        title: 'They can suspend you immediately for any "breach"; you need 30 days notice to leave',
        plain:
          'Acme gets to pull the plug right away if they think you violated terms. You, on the other hand, have to give 30 days notice and pay through the rest of the term.',
        raw: "Provider may suspend or terminate this Agreement immediately upon written notice in the event of a material breach by Customer. Customer may terminate this Agreement upon thirty (30) days' written notice; fees remain due for the remainder of the Term.",
        action:
          'Ask for a 10-day cure period before they can suspend you, and the right to terminate for cause without paying out the term.',
      },
      {
        id: 'cl-6',
        type: 'payment_terms',
        severity: 'low',
        page: 4,
        title: 'Net 15, late fees of 1.5%/month',
        plain:
          'Pay invoices within 15 days. Late payment racks up 1.5% interest per month. Reasonable.',
        raw: 'All invoices are due within fifteen (15) days. Late payments accrue interest at the rate of one and one-half percent (1.5%) per month or the maximum rate permitted by law.',
        action:
          'Standard. Consider asking for Net 30 to match your own payment cycle.',
      },
      {
        id: 'cl-7',
        type: 'confidentiality',
        severity: 'low',
        page: 10,
        title: 'Mutual NDA, 3 years after the contract ends',
        plain:
          'Both sides keep each other\'s confidential info private for 3 years after the contract ends. Fair and standard.',
        raw: "Each party agrees to maintain the confidentiality of the other party's Confidential Information for a period of three (3) years following the termination of this Agreement.",
        action: 'No changes needed.',
      },
    ],
    deadlines: [
      {
        id: 'd1',
        date: '2026-06-22',
        label: 'Renewal notice deadline',
        urgency: 'critical',
        note: '60 days before auto-renewal kicks in',
      },
      {
        id: 'd2',
        date: '2026-08-22',
        label: 'Contract auto-renews',
        urgency: 'high',
        note: 'Locks in for another 12 months',
      },
    ],
  },
  {
    id: 'c-office-lease',
    name: '424 Mission St — Office Sublease.pdf',
    counterparty: 'Tideline Holdings LLC',
    kind: 'Commercial Lease',
    pages: 22,
    uploadedAt: '2026-05-11T16:48:00Z',
    expiresAt: '2027-04-30',
    status: 'complete',
    lifecycle: 'negotiating',
    risk: 'medium',
    verdict: 'sign-with-edits',
    verdictNote:
      'Reasonable terms overall. One CAM-charge clause is loosely worded — get that pinned down in writing.',
    summary:
      'A 1-year sublease for 1,800 sqft on Mission. Rent is fair for the area. Watch the operating expense passthrough wording.',
    clauses: [
      {
        id: 'ol-1',
        type: 'rent_increase',
        severity: 'high',
        page: 4,
        title: 'Operating expenses ("CAM charges") are uncapped and billed quarterly',
        plain:
          "On top of your $4,200/mo rent, you owe a share of building costs — maintenance, taxes, insurance. The clause doesn't cap how much these can grow, so your real cost could jump 10–20% in a year without notice.",
        raw: 'Tenant shall pay Tenant\'s Proportionate Share of all Operating Expenses, including but not limited to real estate taxes, insurance, utilities, maintenance and repairs, billed quarterly in arrears. Operating Expenses shall be subject to annual reconciliation.',
        action:
          "Ask for a 5% annual cap on CAM increases, and the right to audit landlord's books once a year.",
        suggestion:
          'Try: "Controllable Operating Expenses shall not increase by more than five percent (5%) per calendar year on a cumulative, compounded basis."',
      },
      {
        id: 'ol-2',
        type: 'termination',
        severity: 'medium',
        page: 11,
        title: "You can't leave early — and you owe rent for the full term",
        plain:
          'If you need to move out before April 30, 2027, you still owe rent for every remaining month. No early termination for business reasons.',
        raw: 'Tenant shall have no right to terminate this Lease prior to expiration of the Term except as expressly set forth herein. In the event of early vacancy, Tenant shall remain liable for all Rent through the end of the Term.',
        action:
          'Ask for an early-termination option after month 6 with 60 days notice and a 2-month penalty. Standard ask for SMB tenants.',
      },
      {
        id: 'ol-3',
        type: 'alterations',
        severity: 'medium',
        page: 14,
        title: 'You need written approval for any changes — even painting',
        plain:
          "You can't paint a wall, mount a TV, or put up shelves without the landlord's written OK. They can also force you to undo it all when you leave.",
        raw: "Tenant shall make no alterations, additions or improvements to the Premises without Landlord's prior written consent. Upon expiration or termination, Landlord may require removal of any such alterations at Tenant's sole cost.",
        action:
          'Carve out "non-structural cosmetic changes" (paint, art, mounting) as permitted without approval.',
      },
      {
        id: 'ol-4',
        type: 'deposit',
        severity: 'low',
        page: 2,
        title: "Two months' security deposit, returnable within 30 days of move-out",
        plain:
          'You pay $8,400 upfront as security. Returned within 30 days after you move out, minus any documented damage. Standard.',
        raw: 'Tenant shall deposit with Landlord the sum of Eight Thousand Four Hundred Dollars ($8,400) as security for performance of Tenant\'s obligations. Landlord shall return such deposit, less lawful deductions, within thirty (30) days of expiration.',
        action: 'No changes needed.',
      },
    ],
    deadlines: [
      {
        id: 'd3',
        date: '2026-06-01',
        label: 'Security deposit due',
        urgency: 'medium',
        note: "$8,400 — two months' rent",
      },
      {
        id: 'd4',
        date: '2027-01-30',
        label: 'Renewal option window',
        urgency: 'low',
        note: '90-day window opens',
      },
    ],
  },
  {
    id: 'c-contractor-msa',
    name: 'Hartwell Design — Contractor Agreement.docx',
    counterparty: 'Mara Hartwell (Hartwell Design)',
    kind: 'Independent Contractor',
    pages: 6,
    uploadedAt: '2026-05-14T09:02:00Z',
    expiresAt: null,
    status: 'complete',
    lifecycle: 'active',
    signedAt: '2026-05-15',
    risk: 'low',
    verdict: 'sign',
    verdictNote: 'Clean, fair, mutual. Safe to sign as-is.',
    summary:
      'A short, mutual contractor agreement for brand identity work. IP assigns to you on payment. Nothing surprising.',
    clauses: [
      {
        id: 'co-1',
        type: 'ip_assignment',
        severity: 'low',
        page: 2,
        title: 'All design work becomes yours when you pay the final invoice',
        plain:
          'Every logo, mark, and file Mara makes becomes your IP the moment you pay. She can show the work in her portfolio, but you own it.',
        raw: "Upon full payment of all undisputed fees, Contractor hereby assigns to Client all right, title, and interest in and to the Deliverables, including all intellectual property rights therein. Contractor retains the right to display the Deliverables in Contractor's portfolio.",
        action: 'No changes needed — this is exactly how it should read.',
      },
      {
        id: 'co-2',
        type: 'payment_terms',
        severity: 'low',
        page: 3,
        title: '50% upfront, 50% on delivery, Net 15',
        plain:
          '$4,000 deposit before work starts, remaining $4,000 within 15 days of final delivery. Fair and standard for a freelancer.',
        raw: 'Client shall pay Contractor a deposit of fifty percent (50%) of the Fee upon execution of this Agreement. The remaining balance shall be paid within fifteen (15) days of delivery of the final Deliverables.',
        action: 'No changes needed.',
      },
      {
        id: 'co-3',
        type: 'revisions',
        severity: 'medium',
        page: 3,
        title: 'Two rounds of revisions included; extras billed at $150/hr',
        plain:
          'You get 2 rounds of feedback included in the price. After that, Mara charges $150/hour for additional changes. Reasonable.',
        raw: "The Fee includes two (2) rounds of revisions per Deliverable. Additional revisions shall be billed at Contractor's then-current hourly rate of One Hundred Fifty Dollars ($150) per hour.",
        action:
          'Consider asking for 3 rounds if you anticipate a lot of stakeholder input, or get a not-to-exceed estimate before approving overages.',
      },
    ],
    deadlines: [],
  },
  {
    id: 'c-nda-vendor',
    name: 'Mutual NDA — Brightland Partners.pdf',
    counterparty: 'Brightland Partners',
    kind: 'Mutual NDA',
    pages: 4,
    uploadedAt: '2026-05-13T14:20:00Z',
    expiresAt: '2028-05-13',
    status: 'complete',
    lifecycle: 'signed',
    signedAt: '2026-05-13',
    risk: 'low',
    verdict: 'sign',
    verdictNote:
      'Standard mutual NDA. Symmetric obligations, 2-year term, reasonable definition of "confidential information."',
    summary:
      "Both sides agree to keep each other's confidential info private for 2 years. Nothing tricky.",
    clauses: [
      {
        id: 'nda-1',
        type: 'confidentiality',
        severity: 'low',
        page: 1,
        title: "Both sides keep each other's information confidential for 2 years",
        plain:
          'Either party who receives confidential information has to keep it private until May 13, 2028, and use it only for the purpose you\'re discussing together.',
        raw: 'Each party (the "Receiving Party") agrees to maintain the confidentiality of any information disclosed by the other party (the "Disclosing Party") and to use such information solely for the purpose of evaluating the proposed business relationship, for a period of two (2) years from the date hereof.',
        action: 'No changes needed. Standard mutual term.',
      },
      {
        id: 'nda-2',
        type: 'governing_law',
        severity: 'low',
        page: 3,
        title: 'Disputes go to Delaware courts',
        plain:
          'Delaware law applies; lawsuits would be filed in Delaware state court. Common default.',
        raw: 'This Agreement shall be governed by the laws of the State of Delaware, without regard to its conflict of laws principles. The parties consent to the exclusive jurisdiction of the state and federal courts located in New Castle County, Delaware.',
        action: 'No changes needed.',
      },
    ],
    deadlines: [
      {
        id: 'd-nda-1',
        date: '2028-05-13',
        label: 'NDA expires',
        urgency: 'low',
        note: 'Obligations end',
      },
    ],
  },
  {
    id: 'c-employment-offer',
    name: 'Maya Park — Offer Letter.pdf',
    counterparty: 'Maya Park',
    kind: 'Employment Offer',
    pages: 5,
    uploadedAt: '2026-05-14T11:30:00Z',
    expiresAt: null,
    status: 'complete',
    lifecycle: 'reviewing',
    risk: 'medium',
    verdict: 'sign-with-edits',
    verdictNote:
      "Standard offer letter for your first hire. The IP assignment + at-will language are fine. The non-compete is too broad — California won't enforce it but it's bad form to include.",
    summary:
      "A 1-year offer letter for Maya Park (Senior Designer) at $135k base + 0.4% equity. Most of it's clean. The non-compete clause shouldn't be there at all.",
    clauses: [
      {
        id: 'emp-1',
        type: 'non_compete',
        severity: 'high',
        page: 4,
        title: 'Maya can\'t work at any "competing" company for a year after she leaves',
        plain:
          "This says Maya can't work at a competitor for 12 months after leaving. In California, non-competes are unenforceable for employees — including this is unfriendly and signals legal sloppiness. Most candidates will flag it.",
        raw: 'Employee agrees that, during the term of employment and for a period of twelve (12) months thereafter, Employee shall not directly or indirectly engage in any business that competes with the Company within the geographic area in which the Company conducts business.',
        action:
          'Strike this clause. California Business and Professions Code section 16600 makes it void anyway. Keep the non-solicit instead.',
        suggestion:
          "Try: \"Employee agrees not to solicit Company's customers or employees for a period of twelve (12) months following termination.\"",
      },
      {
        id: 'emp-2',
        type: 'ip_assignment',
        severity: 'medium',
        page: 2,
        title: 'Anything Maya invents during the job belongs to the company',
        plain:
          'Work-product Maya creates during her job is the company\'s. There\'s a carve-out for things she invents on her own time without company resources — required by California Labor Code 2870.',
        raw: 'Employee hereby assigns to Company all right, title, and interest in any inventions, discoveries, or works of authorship created by Employee during the term of employment, subject to the limitations of California Labor Code Section 2870.',
        action:
          'Standard. The §2870 carve-out is required by California law and is present. Fine to sign.',
      },
      {
        id: 'emp-3',
        type: 'termination',
        severity: 'medium',
        page: 3,
        title: 'At-will employment: either side can end the job with 2 weeks notice',
        plain:
          'Maya can leave with 2 weeks notice. The company can let her go at any time, for any lawful reason, with 2 weeks severance.',
        raw: "Employment with the Company is at-will. Either party may terminate the employment relationship at any time, with or without cause, upon providing two (2) weeks' written notice. The Company shall pay Employee two (2) weeks of severance upon termination without cause.",
        action:
          'Standard. Consider extending severance to 4 weeks for senior roles as a goodwill gesture.',
      },
      {
        id: 'emp-4',
        type: 'payment_terms',
        severity: 'low',
        page: 1,
        title: '$135,000 base salary, paid bi-weekly',
        plain:
          '$135k annual base. Paid every two weeks. Standard payment cadence.',
        raw: "Employee shall receive an annual base salary of One Hundred Thirty-Five Thousand Dollars ($135,000), payable in accordance with Company's standard bi-weekly payroll schedule.",
        action: 'No changes needed.',
      },
    ],
    deadlines: [
      {
        id: 'd-emp-1',
        date: '2026-06-01',
        label: 'Offer expires',
        urgency: 'high',
        note: 'Maya needs to accept by this date',
      },
    ],
  },
  {
    id: 'c-stripe-tos',
    name: 'Stripe Atlas — Terms of Service.pdf',
    counterparty: 'Stripe, Inc.',
    kind: 'Payment Processor',
    pages: 31,
    uploadedAt: '2026-05-15T08:30:00Z',
    expiresAt: null,
    status: 'analyzing',
    risk: null,
    verdict: null,
    summary: null,
    clauses: [],
    deadlines: [],
  },
  {
    id: 'c-failed',
    name: 'Notarized — scan_004.pdf',
    counterparty: null,
    kind: null,
    pages: 0,
    uploadedAt: '2026-05-14T17:11:00Z',
    expiresAt: null,
    status: 'failed',
    failReason:
      "Couldn't read this PDF — looks like a scanned image without OCR. Try a text-based PDF or run OCR first.",
    risk: null,
    verdict: null,
    summary: null,
    clauses: [],
    deadlines: [],
  },
]
