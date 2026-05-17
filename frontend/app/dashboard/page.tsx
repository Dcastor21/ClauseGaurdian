'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Dashboard } from '@/components/cg/dashboard'
import { UploadModal, CommandPalette } from '@/components/cg/upload'
import { loadContractsShallow } from '@/lib/cg/fetch'
import { uploadContract } from '@/lib/api'
import { deriveNotifications } from '@/lib/cg/adapt'
import { SEED_CONTRACTS, type CgContract, type CgNotification } from '@/lib/cg/data'

export default function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const router = useRouter()

  const [contracts, setContracts] = useState<CgContract[]>([])
  const [samples, setSamples] = useState(false)
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [showUpload, setShowUpload] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [readNotifs, setReadNotifs] = useState<Set<string>>(new Set())

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchContracts = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    try {
      setContracts(await loadContractsShallow(token))
    } catch {
      /* transient — keep last good state */
    }
  }, [getToken])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }
    if (!samples) fetchContracts()
  }, [isLoaded, isSignedIn, router, fetchContracts, samples])

  useEffect(() => {
    if (samples) return
    const hasActive = contracts.some(
      (c) => c.status === 'processing' || c.status === 'analyzing',
    )
    if (hasActive) {
      pollTimer.current = setInterval(fetchContracts, 5000)
    } else if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [contracts, fetchContracts, samples])

  // ⌘K command palette
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowPalette((s) => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const visible = samples ? SEED_CONTRACTS : contracts
  const notifications: CgNotification[] = deriveNotifications(visible).map((n) =>
    readNotifs.has(n.id) ? { ...n, read: true } : n,
  )
  const markRead = (id: string) => setReadNotifs((s) => new Set(s).add(id))

  return (
    <>
      <Dashboard
        contracts={visible}
        query={query}
        setQuery={setQuery}
        riskFilter={riskFilter}
        setRiskFilter={setRiskFilter}
        view={view}
        setView={setView}
        onOpen={(id) => router.push(`/contracts/${id}`)}
        onUpload={() => setShowUpload(true)}
        onOpenPalette={() => setShowPalette(true)}
        onLoadSamples={() => setSamples(true)}
        notifications={notifications}
        onMarkRead={markRead}
      />

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onComplete={() => fetchContracts()}
          uploadFile={async (file) => {
            const token = await getToken()
            if (!token) throw new Error('Not signed in.')
            await uploadContract(token, file)
          }}
        />
      )}

      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        contracts={visible}
        onOpenContract={(id) => router.push(`/contracts/${id}`)}
      />
    </>
  )
}
