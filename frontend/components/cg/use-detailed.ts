'use client'

// components/cg/use-detailed.ts — load fully-hydrated contracts + derived
// notifications for the analytics / calendar / compare / counterparty pages.
import * as React from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { loadContractsDetailed } from '@/lib/cg/fetch'
import { deriveNotifications } from '@/lib/cg/adapt'
import type { CgContract, CgNotification } from '@/lib/cg/data'

export function useDetailedContracts() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const [contracts, setContracts] = React.useState<CgContract[]>([])
  const [loading, setLoading] = React.useState(true)
  const [readNotifs, setReadNotifs] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }
    getToken().then((token) => {
      if (!token) return
      loadContractsDetailed(token)
        .then(setContracts)
        .catch(() => {})
        .finally(() => setLoading(false))
    })
  }, [isLoaded, isSignedIn, getToken, router])

  const notifications: CgNotification[] = deriveNotifications(contracts).map((n) =>
    readNotifs.has(n.id) ? { ...n, read: true } : n,
  )
  const markRead = (id: string) =>
    setReadNotifs((s) => new Set(s).add(id))

  return { contracts, loading, notifications, markRead }
}
