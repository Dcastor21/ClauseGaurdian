'use client'

import { useRouter } from 'next/navigation'
import { AnalyticsPage } from '@/components/cg/analytics'
import { useCgChrome } from '@/components/cg/chrome'
import { useDetailedContracts } from '@/components/cg/use-detailed'

export default function Analytics() {
  const router = useRouter()
  const { contracts, notifications, markRead } = useDetailedContracts()
  const { onUpload, onOpenPalette, modals } = useCgChrome({ contracts })

  return (
    <>
      <AnalyticsPage
        contracts={contracts}
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
