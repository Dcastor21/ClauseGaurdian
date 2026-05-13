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

const STATUS_STYLES: Record<Contract['status'], string> = {
  processing: 'bg-gray-100 text-gray-600',
  analyzing: 'bg-blue-100 text-blue-600',
  complete: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
}

const RISK_BORDER: Record<string, string> = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#CA8A04',
  low: '#16A34A',
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg }: {
  label: string; value: number; icon: LucideIcon; iconColor: string; iconBg: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
        <p className="font-mono text-3xl font-extrabold leading-none text-navy">{value}</p>
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
  const [risk, setRisk] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // fetchContracts never closes over search/risk — callers always pass them explicitly.
  // Deps are [getToken] only so the function reference is stable across search/risk changes,
  // which prevents the poll effect from restarting on every keystroke.
  const fetchContracts = useCallback(
    async (q: string, r: string) => {
      const token = await getToken()
      if (!token) return
      try {
        const data = await listContracts(token, { search: q || undefined, risk: r || undefined })
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
    fetchContracts(search, risk).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, router, fetchContracts])

  // Auto-poll while any contract is still processing
  useEffect(() => {
    const hasActive = contracts.some((c) => c.status === 'processing' || c.status === 'analyzing')
    if (hasActive) {
      pollTimer.current = setInterval(() => fetchContracts(search, risk), 5000)
    } else {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null }
    }
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [contracts, fetchContracts, search, risk])

  function onSearchChange(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchContracts(val, risk), 300)
  }

  function onRiskChange(val: string) {
    setRisk(val)
    fetchContracts(search, val)
  }

  async function handleDelete(id: string) {
    const token = await getToken()
    if (!token) return
    setDeletingId(id)
    try {
      await deleteContract(token, id)
      setContracts((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

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
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          {/* mobile: min-w and shrink-0 prevent the filter from collapsing below readable width */}
          <label htmlFor="risk-filter" className="sr-only">Filter by risk level</label>
          <select
            id="risk-filter"
            value={risk}
            onChange={(e) => onRiskChange(e.target.value)}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white min-w-[120px] shrink-0"
          >
            <option value="">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {/* mobile: py-3 for ≥44px tap target; sm:ml-auto avoids orphaned right-align when wrapped */}
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-accent text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors sm:ml-auto shrink-0 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <Upload className="w-4 h-4" aria-hidden="true" /> Upload
          </button>
        </header>

        {contracts.length > 0 && (
          <div className="px-4 md:px-8 pt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Contracts"
              value={contracts.length}
              icon={FileText}
              iconColor="#2563EB"
              iconBg="#eff6ff"
            />
            <StatCard
              label="At Risk"
              value={contracts.filter((c) => c.overall_risk === 'critical' || c.overall_risk === 'high').length}
              icon={AlertTriangle}
              iconColor="#EA580C"
              iconBg="#fff7ed"
            />
            <StatCard
              label="Expiring ≤30d"
              value={contracts.filter((c) => { const d = daysUntil(c.expires_at); return d !== null && d <= 30 && d > 0 }).length}
              icon={Clock}
              iconColor="#D97706"
              iconBg="#fffbeb"
            />
            <StatCard
              label="Failed Analyses"
              value={contracts.filter((c) => c.status === 'failed').length}
              icon={AlertCircle}
              iconColor="#DC2626"
              iconBg="#fef2f2"
            />
          </div>
        )}

        {/* Table */}
        <div className="flex-1 px-4 md:px-8 py-6 overflow-x-auto">
          {loading && contracts.length === 0 ? (
            <div className="divide-y divide-gray-100 pt-1">
              {[...Array(5)].map((_, i) => <Skeleton key={i} variant="row" />)}
            </div>
          ) : contracts.length === 0 ? (
            <OnboardingCard onUpload={() => setShowUpload(true)} />
          ) : (
            <>
              {/* mobile: stacked card list replaces the table below sm breakpoint */}
              <div className="sm:hidden space-y-3">
                {contracts.map((c) => {
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
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/contracts/${c.id}`) }}
                    >
                      <div className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 truncate">{c.name}</p>
                          <p className="font-mono text-xs text-gray-400 mt-0.5">{formatDate(c.created_at)}</p>
                        </div>
                        {/* mobile: p-2.5 and min-h/w ensure ≥44px tap target on the delete button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }}
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
              {/* mobile: table hidden below sm — card list used instead */}
              <table className="hidden sm:table w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th scope="col" className="pb-3 font-medium">Name</th>
                    <th scope="col" className="pb-3 font-medium">Uploaded</th>
                    <th scope="col" className="pb-3 font-medium">Status</th>
                    <th scope="col" className="pb-3 font-medium">Risk</th>
                    <th scope="col" className="pb-3 font-medium">Expires</th>
                    <th scope="col" className="pb-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contracts.map((c) => {
                    const days = daysUntil(c.expires_at)
                    const urgent = days !== null && days <= 7
                    const warn = days !== null && days <= 14 && days > 7
                    return (
                      <tr
                        key={c.id}
                        tabIndex={0}
                        className="hover:bg-gray-50 cursor-pointer transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent/50"
                        onClick={() => router.push(`/contracts/${c.id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/contracts/${c.id}`) }}
                      >
                        <td
                          className="py-3 pr-4 font-medium text-gray-900 max-w-[180px] truncate"
                          style={{ borderLeft: `3px solid ${c.overall_risk ? RISK_BORDER[c.overall_risk] : 'transparent'}` }}
                        >
                          {c.name}
                        </td>
                        <td className="py-3 pr-4 font-mono text-gray-500 text-xs whitespace-nowrap">
                          {formatDate(c.created_at)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={clsx('rounded px-2 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[c.status])}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <RiskBadge risk={c.overall_risk} />
                        </td>
                        <td className="py-3 pr-4">
                          {c.expires_at ? (
                            <div className="flex items-center gap-2">
                              <span className={clsx('font-mono text-xs', urgent ? 'text-red-600 font-semibold' : 'text-gray-500')}>
                                {days !== null && days >= 0
                                  ? `${days}d`
                                  : <span className="text-gray-400">Expired</span>}
                              </span>
                              {(urgent || warn) && (
                                <span className={clsx('rounded px-1.5 py-0.5 text-xs font-medium', urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                                  {urgent ? '≤7d' : '≤14d'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs font-mono">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {/* mobile: p-2.5 ensures adequate tap target on the table delete button at sm+ */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }}
                            disabled={deletingId === c.id}
                            aria-label={`Delete ${c.name}`}
                            className="text-gray-400 hover:text-red-500 transition-colors p-2.5 rounded focus:outline-none focus:ring-2 focus:ring-red-300"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </main>

      {showUpload && (
        <UploadModal
          getToken={async () => getToken()}
          onComplete={() => { fetchContracts(search, risk); setShowUpload(false) }}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}
