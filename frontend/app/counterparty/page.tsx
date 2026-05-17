'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CounterpartyPage } from '@/components/cg/counterparty'
import { useCgChrome } from '@/components/cg/chrome'
import { useDetailedContracts } from '@/components/cg/use-detailed'

function CounterpartyInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { contracts, notifications, markRead } = useDetailedContracts()
  const { onUpload, onOpenPalette, modals } = useCgChrome({ contracts })

  const name =
    params.get('name') ??
    contracts.find((c) => c.counterparty)?.counterparty ??
    undefined

  return (
    <>
      <CounterpartyPage
        contracts={contracts}
        counterpartyName={name ?? undefined}
        onOpen={(id) => router.push(`/contracts/${id}`)}
        onUpload={onUpload}
        onOpenPalette={onOpenPalette}
        notifications={notifications}
        onMarkRead={markRead}
      />
      {modals}
    </>
  )
}

export default function Counterparty() {
  return (
    <Suspense>
      <CounterpartyInner />
    </Suspense>
  )
}
