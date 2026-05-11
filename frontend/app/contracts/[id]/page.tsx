'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Calendar, FileText } from 'lucide-react'
import { clsx } from 'clsx'
import { getContract, listClauses, listDeadlines, type Contract, type Clause, type Deadline } from '../../../lib/api'
import { RiskBadge } from '../../../components/RiskBadge'
import { RiskGauge } from '../../../components/RiskGauge'
import { ClauseCard } from '../../../components/ClauseCard'

const SEVERITY_ORDER: Clause['severity'][] = ['critical', 'high', 'medium', 'low']

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function uniqueDeadlines(deadlines: Deadline[]): Deadline[] {
  const seen = new Set<string>()
  return deadlines
    .filter((d) => { const key = d.deadline_date.slice(0, 10); if (seen.has(key)) return false; seen.add(key); return true })
    .sort((a, b) => new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime())
}

export default function ContractDetailPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [contract, setContract] = useState<Contract | null>(null)
  const [clauses, setClauses] = useState<Clause[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.push('/sign-in'); return }

    async function load() {
      const token = await getToken()
      if (!token) return
      try {
        const [c, cl, dl] = await Promise.all([
          getContract(token, id),
          listClauses(token, id),
          listDeadlines(token, id),
        ])
        setContract(c)
        setClauses(cl.slice().sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)))
        setDeadlines(dl)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load contract.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isLoaded, isSignedIn, id, getToken, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 text-sm">{error ?? 'Contract not found.'}</p>
        <button onClick={() => router.push('/dashboard')} className="text-accent text-sm underline">
          Back to dashboard
        </button>
      </div>
    )
  }

  const uniqueDl = uniqueDeadlines(deadlines)
  const criticalCount = clauses.filter((c) => c.severity === 'critical').length
  const highCount = clauses.filter((c) => c.severity === 'high').length

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">{contract.name}</h1>
        </div>
        <RiskBadge risk={contract.overall_risk} />
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Summary card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col md:flex-row items-center gap-6">
          <RiskGauge risk={contract.overall_risk} />
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center md:text-left">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Clauses</p>
              <p className="font-mono text-2xl font-semibold text-gray-900">{clauses.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Critical</p>
              <p className="font-mono text-2xl font-semibold text-red-600">{criticalCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">High</p>
              <p className="font-mono text-2xl font-semibold text-orange-500">{highCount}</p>
            </div>
          </div>
        </div>

        {/* Deadline timeline */}
        {uniqueDl.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" /> Deadlines
            </h2>
            <div className="space-y-2">
              {uniqueDl.map((d) => {
                const days = daysUntil(d.deadline_date)
                const urgent = days <= 7
                const warn = days <= 14 && days > 7
                return (
                  <div
                    key={d.id}
                    className={clsx(
                      'bg-white rounded-lg border px-4 py-3 flex items-center justify-between',
                      urgent ? 'border-red-200' : warn ? 'border-amber-200' : 'border-gray-200',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-gray-700">{formatDate(d.deadline_date)}</span>
                      <span className="text-xs text-gray-400">{d.alert_window}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(urgent || warn) && (
                        <span
                          className={clsx(
                            'rounded px-2 py-0.5 text-xs font-medium',
                            urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                          )}
                        >
                          {urgent ? '≤7d' : '≤14d'}
                        </span>
                      )}
                      <span
                        className={clsx(
                          'font-mono text-sm font-semibold',
                          urgent ? 'text-red-600' : warn ? 'text-amber-600' : 'text-gray-500',
                        )}
                      >
                        {days >= 0 ? `${days}d` : 'Expired'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Clause list */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" /> Clauses ({clauses.length})
          </h2>
          {clauses.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              {contract.status === 'analyzing' ? 'Analyzing contract...' : 'No clauses found.'}
            </p>
          ) : (
            <div className="space-y-2">
              {clauses.map((c) => (
                <ClauseCard key={c.id} clause={c} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
