'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Settings, CreditCard, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function getInitials(firstName?: string | null, lastName?: string | null, email?: string): string {
  const fl = (firstName?.[0] ?? '') + (lastName?.[0] ?? '')
  if (fl.trim()) return fl.toUpperCase()
  return email?.[0]?.toUpperCase() ?? '?'
}

export function UserWidget() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()

  const initials = getInitials(
    user?.firstName,
    user?.lastName,
    user?.emailAddresses[0]?.emailAddress,
  )
  const displayName = user?.fullName ?? user?.emailAddresses[0]?.emailAddress ?? '…'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
            {initials}
          </div>
        )}
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white">{displayName}</p>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/settings?tab=plan')}>
          <CreditCard />
          Billing &amp; plan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut(() => router.push('/sign-in'))}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
