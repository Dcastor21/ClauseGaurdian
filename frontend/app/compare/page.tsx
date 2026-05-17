'use client'

import { useRouter } from 'next/navigation'
import { ComparePage } from '@/components/cg/compare'
import { useCgChrome } from '@/components/cg/chrome'
import { useDetailedContracts } from '@/components/cg/use-detailed'

export default function Compare() {
  const router = useRouter()
  const { contracts, notifications, markRead } = useDetailedContracts()
  const { onUpload, onOpenPalette, modals } = useCgChrome({ contracts })

  return (
    <>
      <ComparePage
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
