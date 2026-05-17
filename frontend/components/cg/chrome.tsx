'use client'

// components/cg/chrome.tsx — shared top-bar chrome (upload modal + ⌘K palette)
// so every PageShell page gets working global actions without duplication.
import * as React from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { UploadModal, CommandPalette } from './upload'
import { uploadContract } from '@/lib/api'
import type { CgContract } from '@/lib/cg/data'

export function useCgChrome({
  contracts,
  onUploaded,
}: {
  contracts: CgContract[]
  onUploaded?: () => void
}) {
  const { getToken } = useAuth()
  const router = useRouter()
  const [showUpload, setShowUpload] = React.useState(false)
  const [showPalette, setShowPalette] = React.useState(false)

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowPalette((s) => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onUpload = React.useCallback(() => setShowUpload(true), [])
  const onOpenPalette = React.useCallback(() => setShowPalette(true), [])

  const modals = (
    <>
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onComplete={onUploaded}
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
        contracts={contracts}
        onOpenContract={(id) => router.push(`/contracts/${id}`)}
      />
    </>
  )

  return { onUpload, onOpenPalette, modals }
}
