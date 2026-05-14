'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Upload, Search, Trash2, FileText, Shield, AlertTriangle, Clock, AlertCircle, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { listContracts, deleteContract, type Contract } from '../../lib/api'
import { RiskBadge } from '../../components/RiskBadge'
import { UploadModal } from '../../components/UploadModal'
import { Skeleton } from '../../components/Skeleton'
import { OnboardingCard } from '../../components/OnboardingCard'
import { RiskFilter } from '../../components/RiskFilter'
import { CommandPalette } from '../../components/CommandPalette'
import { ContractsTable } from '../../components/ContractsTable'
import { UserWidget } from '../../components/UserWidget'

const RISK_BORDER: Record<string, string> = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#CA8A04',
  low: '#16A34A',
}

const STATUS_STYLES: Record<Contract['status'], string> = {
  processing: 'bg-gray-100 text-gray-600',
  analyzing:  'bg-blue-100 text-blue-600',
  complete:   'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-600',
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function StatCard({
  label, value, sub, delta, icon: Icon, iconColor, iconBg,
}: {
  label: string
  value: number
  sub?: string
  delta?: number
  icon: LucideIcon
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
        <p className="font-mono text-3xl font-extrabold leading-none text-navy">{value}</p>
        {delta !== undefined && (
          <p className={clsx('text-xs mt-1.5', delta > 0 ? 'text-orange-500' : 'text-gray-400')}>
            {delta > 0 ? `+${delta}` : 'None'} this week
          </p>
        )}
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      <div className="rounded-xl p-2.5 shrink-0" style={{ background: iconBg }}>
        <Icon className="w-[17px] h-[17px]" style={{ color: iconColor }} aria-hidden="true" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const router = useRouter()

  const [contracts, setContracts] = useState<Contract[]>([])
  const [search, setSearch] = useState('')
  const [risks, setRisks] = useState<string[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Risk filtering is client-side; only search goes to the API
  const displayContracts = risks.length > 0
    ? contracts.filter(c => c.overall_risk != null && risks.includes(c.overall_risk))
    : contracts

  const fetchContracts = useCallback(
    async (q: string) => {
      const token = await getToken()
      if (!token) return
      try {
        const data = await listContracts(token, { search: q || undefined })
        setContracts(data)
      } catch {
        // ignore transient errors
      }
    },
    [getToken],
  )

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.push('/sign-in'); return }
    setLoading(true)
    fetchContracts(search).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, router, fetchContracts])

  useEffect(() => {
    const hasActive = contracts.some(c => c.status === 'processing' || c.status === 'analyzing')
    if (hasActive) {
      pollTimer.current = setInterval(() => fetchContracts(search), 5000)
    } else if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [contracts, fetchContracts, search])

  function onSearchChange(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchContracts(val), 300)
  }

  async function handleDelete(id: string) {
    const token = await getToken()
    if (!token) return
    setDeletingId(id)
    try {
      await deleteContract(token, id)
      setContracts(prev => prev.filter(c => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  // Trend deltas — "new in last 7 days"
  const cutoff = Date.now() - SEVEN_DAYS_MS
  const newThisWeek = contracts.filter(c => new Date(c.created_at).getTime() > cutoff)
  const totalDelta = newThisWeek.length
  const atRiskDelta = newThisWeek.filter(
    c => c.overall_risk === 'critical' || c.overall_risk === 'high',
  ).length

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-navy shrink-0 p-5 gap-6">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" aria-hidden="true" />
          <span className="text-white font-semibold text-sm">ClauseGuardian</span>
        </div>
        <nav className="flex flex-col gap-1">
          <span className="text-white bg-white/10 rounded-md px-3 py-2 text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4" aria-hidden="true" /> Contracts
          </span>
        </nav>
        {/* Cmd+K hint + user widget */}
        <div className="mt-auto flex flex-col gap-3">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <kbd className="inline-flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">⌘K</kbd>
            Quick search
          </p>
          <div className="border-t border-white/10 pt-3">
            <UserWidget />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 md:px-8 py-4 border-b border-gray-200 bg-white flex-wrap">
          <div className="flex items-center gap-2 md:hidden">
            <Shield className="w-5 h-5 text-accent" />
            <span className="font-semibold text-sm text-navy">ClauseGuardian</span>
          </div>
          <div className="relative flex-1 min-w-0 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <label htmlFor="contract-search" className="sr-only">Search contracts</label>
            <input
              id="contract-search"
              type="text"
              placeholder="Search contracts..."
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <RiskFilter value={risks} onChange={setRisks} />

          {/* mobile: py-3 for ≥44px tap target; sm:ml-auto avoids orphaned right-align when wrapped */}
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-accent text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors sm:ml-auto shrink-0 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <Upload className="w-4 h-4" aria-hidden="true" /> Upload
          </button>
        </header>

        {/* Stat cards — only shown when there are contracts */}
        {contracts.length > 0 && (
          <div className="px-4 md:px-8 pt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Contracts"
              value={contracts.length}
              delta={totalDelta}
              icon={FileText}
              iconColor="#2563EB"
              iconBg="#eff6ff"
            />
            <StatCard
              label="At Risk"
              value={contracts.filter(c => c.overall_risk === 'critical' || c.overall_risk === 'high').length}
              delta={atRiskDelta}
              icon={AlertTriangle}
              iconColor="#EA580C"
              iconBg="#fff7ed"
            />
            <StatCard
              label="Expiring ≤30d"
              value={contracts.filter(c => { const d = daysUntil(c.expires_at); return d !== null && d <= 30 && d > 0 }).length}
              sub="Needs attention"
              icon={Clock}
              iconColor="#D97706"
              iconBg="#fffbeb"
            />
            <StatCard
              label="Failed Analyses"
              value={contracts.filter(c => c.status === 'failed').length}
              icon={AlertCircle}
              iconColor="#DC2626"
              iconBg="#fef2f2"
            />
          </div>
        )}

        {/* Table area */}
        <div className="flex-1 px-4 md:px-8 py-6 overflow-x-auto">
          {loading && contracts.length === 0 ? (
            <div className="divide-y divide-gray-100 pt-1">
              {[...Array(5)].map((_, i) => <Skeleton key={i} variant="row" />)}
            </div>
          ) : displayContracts.length === 0 ? (
            contracts.length === 0 ? (
              <OnboardingCard onUpload={() => setShowUpload(true)} />
            ) : (
              // Active filters returned no results
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <p className="text-gray-500 text-sm">No contracts match your current filters.</p>
                <button
                  onClick={() => setRisks([])}
                  className="text-accent text-sm underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  Clear filters
                </button>
              </div>
            )
          ) : (
            <>
              {/* Mobile: stacked card list replaces the table below sm breakpoint */}
              <div className="sm:hidden space-y-3">
                {displayContracts.map(c => {
                  const days = daysUntil(c.expires_at)
                  const urgent = days !== null && days <= 7
                  const warn = days !== null && days <= 14 && days > 7
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View contract: ${c.name}`}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
                      style={{ borderLeftWidth: '3px', borderLeftStyle: 'solid', borderLeftColor: c.overall_risk ? RISK_BORDER[c.overall_risk] : 'transparent' }}
                      onClick={() => router.push(`/contracts/${c.id}`)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') router.push(`/contracts/${c.id}`) }}
                    >
                      <div className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 truncate">{c.name}</p>
                          <p className="font-mono text-xs text-gray-400 mt-0.5">{formatDate(c.created_at)}</p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(c.id) }}
                          disabled={deletingId === c.id}
                          aria-label={`Delete ${c.name}`}
                          className="text-gray-400 hover:text-red-500 transition-colors p-2.5 rounded min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 focus:outline-none focus:ring-2 focus:ring-red-300"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                        <span className={clsx('rounded px-2 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[c.status])}>
                          {c.status}
                        </span>
                        <RiskBadge risk={c.overall_risk} />
                        {c.expires_at && (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <span className={clsx('font-mono text-xs', urgent ? 'text-red-600 font-semibold' : 'text-gray-500')}>
                              {days !== null && days >= 0 ? `${days}d` : <span className="text-gray-400">Expired</span>}
                            </span>
                            {(urgent || warn) && (
                              <span className={clsx('rounded px-1.5 py-0.5 text-xs font-medium', urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                                {urgent ? '≤7d' : '≤14d'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop: TanStack sortable table */}
              <ContractsTable
                contracts={displayContracts}
                deletingId={deletingId}
                onDelete={handleDelete}
              />
            </>
          )}
        </div>
      </main>

      {showUpload && (
        <UploadModal
          getToken={async () => getToken()}
          onComplete={() => { fetchContracts(search); setShowUpload(false) }}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* Cmd+K palette — receives full unfiltered list for search */}
      <CommandPalette contracts={contracts} />
    </div>
  )
}
