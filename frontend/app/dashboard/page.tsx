'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Upload, Search, Trash2, FileText, Shield } from 'lucide-react'
import { clsx } from 'clsx'
import { listContracts, deleteContract, type Contract } from '../../lib/api'
import { RiskBadge } from '../../components/RiskBadge'
import { UploadModal } from '../../components/UploadModal'

const STATUS_STYLES: Record<Contract['status'], string> = {
  processing: 'bg-gray-100 text-gray-600',
  analyzing: 'bg-blue-100 text-blue-600',
  complete: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
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

  const fetchContracts = useCallback(
    async (q = search, r = risk) => {
      const token = await getToken()
      if (!token) return
      try {
        const data = await listContracts(token, { search: q || undefined, risk: r || undefined })
        setContracts(data)
      } catch {
        // ignore transient errors
      }
    },
    [getToken, search, risk],
  )

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.push('/sign-in'); return }
    setLoading(true)
    fetchContracts().finally(() => setLoading(false))
  }, [isLoaded, isSignedIn, router, fetchContracts])

  // Auto-poll while any contract is still processing
  useEffect(() => {
    const hasActive = contracts.some((c) => c.status === 'processing' || c.status === 'analyzing')
    if (hasActive) {
      pollTimer.current = setInterval(() => fetchContracts(), 5000)
    } else {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null }
    }
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [contracts, fetchContracts])

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
          <Shield className="w-6 h-6 text-accent" />
          <span className="text-white font-semibold text-sm">ClauseGuardian</span>
        </div>
        <nav className="flex flex-col gap-1">
          <span className="text-white bg-white/10 rounded-md px-3 py-2 text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4" /> Contracts
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contracts..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <select
            value={risk}
            onChange={(e) => onRiskChange(e.target.value)}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
          >
            <option value="">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors ml-auto"
          >
            <Upload className="w-4 h-4" /> Upload
          </button>
        </header>

        {/* Table */}
        <div className="flex-1 px-4 md:px-8 py-6 overflow-x-auto">
          {loading ? (
            <div className="text-center py-20 text-gray-400 text-sm">Loading contracts...</div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No contracts yet. Upload one to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Uploaded</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Risk</th>
                  <th className="pb-3 font-medium">Expires</th>
                  <th className="pb-3" />
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
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/contracts/${c.id}`)}
                    >
                      <td className="py-3 pr-4 font-medium text-gray-900 max-w-[180px] truncate">
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
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }}
                          disabled={deletingId === c.id}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {showUpload && (
        <UploadModal
          getToken={async () => getToken()}
          onComplete={() => { fetchContracts(); setShowUpload(false) }}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}
