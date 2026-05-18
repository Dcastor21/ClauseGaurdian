'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import { ContractDetail } from '@/components/cg/detail'
import { CounterProposalModal } from '@/components/cg/counter'
import { AskAssistant } from '@/components/cg/assistant'
import { Icon } from '@/components/cg/icons'
import { loadContractDetail } from '@/lib/cg/fetch'
import {
  SEED_CONTRACTS,
  type CgContract,
  type CgComment,
  type TriageDecision,
} from '@/lib/cg/data'

// Pre-seeded triage + comments so the sample "Acme MSA" tour shows the full
// workflow on first visit (matches the design demo). Real contracts start clean.
const SEED_TRIAGE: Record<string, TriageDecision> = {
  'cl-1': 'negotiate',
  'cl-2': 'negotiate',
  'cl-6': 'accept',
  'cl-7': 'accept',
}
const SEED_COMMENTS: Record<string, CgComment[]> = {
  'cl-1': [
    {
      id: 'co1',
      author: 'Mara H.',
      role: 'Advisor',
      text: "Worth getting them to 30 days — Acme's standard is actually 30 with enterprise tier. Try it.",
      ts: '2026-05-14T11:22:00Z',
    },
    {
      id: 'co2',
      author: 'Sam (you)',
      role: 'You',
      text: 'Will ask. Also putting a reminder in calendar for April 1, 2027 in case it doesn\'t move.',
      ts: '2026-05-14T15:08:00Z',
    },
  ],
  'cl-2': [
    {
      id: 'co3',
      author: 'Mara H.',
      role: 'Advisor',
      text: 'Push hard on this one. 1 month cap is unusual for SaaS — usually 12.',
      ts: '2026-05-14T11:24:00Z',
    },
  ],
}

export default function ContractDetailPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [contract, setContract] = useState<CgContract | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [triage, setTriageState] = useState<Record<string, TriageDecision | null>>(
    id === 'c-acme-msa' ? SEED_TRIAGE : {},
  )
  const [notes, setNotesState] = useState<Record<string, string | null>>({})
  const [comments, setCommentsState] = useState<Record<string, CgComment[]>>(
    id === 'c-acme-msa' ? SEED_COMMENTS : {},
  )

  const [showCounter, setShowCounter] = useState(false)
  const [showAsk, setShowAsk] = useState(false)

  const setTriage = (cid: string, v: TriageDecision | null) =>
    setTriageState((s) => ({ ...s, [cid]: v }))
  const setNote = (cid: string, v: string | null) =>
    setNotesState((s) => ({ ...s, [cid]: v }))
  const addComment = (clauseId: string, text: string) =>
    setCommentsState((s) => ({
      ...s,
      [clauseId]: [
        ...(s[clauseId] ?? []),
        {
          id: `co-${Date.now()}`,
          author: 'Sam (you)',
          role: 'You',
          text,
          ts: new Date().toISOString(),
        },
      ],
    }))

  const load = useCallback(async () => {
    const seed = SEED_CONTRACTS.find((c) => c.id === id)
    const token = await getToken()
    if (!token) return
    try {
      setContract(await loadContractDetail(token, id))
    } catch {
      if (seed) setContract(seed)
      else setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [getToken, id])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }
    // Sample tour: resolve seed contracts instantly without a backend call.
    const seed = SEED_CONTRACTS.find((c) => c.id === id)
    if (seed) {
      setContract(seed)
      setLoading(false)
      return
    }
    load()
  }, [isLoaded, isSignedIn, id, router, load])

  // Poll while a real contract is still being analyzed.
  useEffect(() => {
    if (!contract) return
    if (contract.status !== 'analyzing' && contract.status !== 'processing') return
    if (SEED_CONTRACTS.some((c) => c.id === id)) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [contract, id, load])

  // "?" toggles Ask ClauseGuardian on the detail page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === '?' &&
        !(e.target as HTMLElement).matches('input, textarea, [contenteditable]')
      ) {
        e.preventDefault()
        setShowAsk((s) => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (loading) {
    return (
      <div
        className="min-h-screen grid place-items-center"
        style={{ background: 'var(--bg)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <span
            className="w-10 h-10 rounded-full grid place-items-center"
            style={{ background: 'var(--primary-2)', color: 'var(--primary)' }}
          >
            <Icon.Leaf size={18} />
          </span>
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            Opening the analysis…
          </p>
        </div>
      </div>
    )
  }

  if (notFound || !contract) {
    return (
      <div
        className="min-h-screen grid place-items-center px-6 text-center"
        style={{ background: 'var(--bg)' }}
      >
        <div>
          <p
            className="font-display text-[40px] leading-[1.18]"
            style={{ color: 'var(--ink)' }}
          >
            That contract isn&apos;t in this garden.
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-2)' }}>
            It may have been deleted, or never planted at all.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: 'var(--primary)' }}
          >
            <Icon.ArrowLeft size={14} /> Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <ContractDetail
        contract={contract}
        onBack={() => router.push('/dashboard')}
        triageState={triage}
        setTriage={setTriage}
        notes={notes}
        setNote={setNote}
        comments={comments}
        addComment={addComment}
        onGenerateCounter={() => setShowCounter(true)}
      />

      <CounterProposalModal
        open={showCounter}
        onClose={() => setShowCounter(false)}
        contract={contract}
        triageState={triage}
        notes={notes}
      />

      {contract.status === 'complete' && (
        <AskAssistant
          open={showAsk}
          onOpen={() => setShowAsk(true)}
          onClose={() => setShowAsk(false)}
          contract={contract}
        />
      )}
    </>
  )
}
