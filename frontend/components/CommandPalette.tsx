'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { RiskBadge } from './RiskBadge'
import type { Contract } from '@/lib/api'

export function CommandPalette({ contracts }: { contracts: Contract[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function go(id: string) {
    setOpen(false)
    router.push(`/contracts/${id}`)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v: boolean) => setOpen(v)}
      title="Find a contract"
      description="Search contracts by name"
      showCloseButton={false}
    >
      <CommandInput placeholder="Search contracts..." />
      <CommandList>
        <CommandEmpty>No contracts found.</CommandEmpty>
        <CommandGroup heading="Contracts">
          {contracts.map(c => (
            <CommandItem
              key={c.id}
              value={c.name}
              onSelect={() => go(c.id)}
              className="gap-3 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="flex-1 truncate">{c.name}</span>
              <RiskBadge risk={c.overall_risk} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
