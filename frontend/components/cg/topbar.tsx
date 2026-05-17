'use client'

// components/cg/topbar.tsx — shared top navigation used by every page.
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import { Btn, Kbd, Leaf } from './primitives'
import { relativeTime, type CgNotification } from '@/lib/cg/data'

const NAV_HREF: Record<string, string> = {
  dashboard: '/dashboard',
  calendar: '/calendar',
  analytics: '/analytics',
  compare: '/compare',
  settings: '/settings',
}

export interface ChromeProps {
  onUpload?: () => void
  onOpenPalette?: () => void
  notifications?: CgNotification[]
  onMarkRead?: (id: string) => void
}

export function TopBar({
  onUpload,
  onOpenPalette,
  hideSearch,
  currentRoute,
  notifications,
  onMarkRead,
}: ChromeProps & { hideSearch?: boolean; currentRoute?: string }) {
  const router = useRouter()
  const [showNotifs, setShowNotifs] = React.useState(false)
  const notifsRef = React.useRef<HTMLDivElement>(null)

  const navItems = [
    { route: 'dashboard', label: 'Garden', icon: Icon.Inbox },
    { route: 'calendar', label: 'Calendar', icon: Icon.Calendar },
    { route: 'analytics', label: 'Analytics', icon: Icon.Hash },
    { route: 'compare', label: 'Compare', icon: Icon.Grid },
    { route: 'settings', label: 'Settings', icon: Icon.Settings },
  ]
  const goto = (route: string) => router.push(NAV_HREF[route] ?? '/dashboard')

  React.useEffect(() => {
    if (!showNotifs) return
    function onClick(e: MouseEvent) {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showNotifs])

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: 'color-mix(in oklch, var(--bg) 92%, transparent)',
        borderColor: 'var(--line)',
        backdropFilter: 'blur(10px) saturate(160%)',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-16 flex items-center gap-3 md:gap-5">
        <button
          className="flex items-center gap-2 shrink-0"
          style={{ color: 'var(--ink)' }}
          onClick={() => router.push('/dashboard')}
        >
          <span
            className="grid place-items-center w-7 h-7 rounded-md"
            style={{ background: 'var(--primary)', color: 'white' }}
          >
            <Leaf size={15} />
          </span>
          <span className="font-display text-[20px] leading-none" style={{ letterSpacing: '-0.01em' }}>
            ClauseGardian
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-0.5 ml-3">
          {navItems.map((it) => {
            const active = (currentRoute ?? 'dashboard') === it.route
            return (
              <button
                key={it.route}
                onClick={() => goto(it.route)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition"
                style={
                  active
                    ? { background: 'var(--surface-2)', color: 'var(--ink)' }
                    : { color: 'var(--ink-3)' }
                }
              >
                <it.icon size={13} />
                {it.label}
              </button>
            )
          })}
        </nav>

        {!hideSearch && (
          <button
            onClick={onOpenPalette}
            className="ml-auto md:ml-2 hidden lg:flex items-center gap-2.5 max-w-xs px-3 h-9 rounded-md text-sm transition hover:opacity-80"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--ink-3)',
              border: '1px solid var(--line)',
              flex: '1 1 240px',
            }}
          >
            <Icon.Search size={14} />
            <span className="truncate">Search…</span>
            <span className="ml-auto">
              <Kbd>⌘K</Kbd>
            </span>
          </button>
        )}

        <div className={`flex items-center gap-2 ${hideSearch ? 'ml-auto' : ''}`}>
          <div ref={notifsRef} className="relative">
            <button
              onClick={() => setShowNotifs((s) => !s)}
              className="relative hidden md:grid w-9 h-9 place-items-center rounded-md transition hover:bg-black/5"
              style={{ color: 'var(--ink-2)' }}
              aria-label="Notifications"
            >
              <Icon.Bell size={16} />
              {unreadCount > 0 && (
                <span
                  className="absolute top-2 right-2 w-2 h-2 rounded-full"
                  style={{ background: 'var(--critical)', boxShadow: '0 0 0 2px var(--bg)' }}
                />
              )}
            </button>
            {showNotifs && (
              <NotificationsPopover
                notifications={notifications ?? []}
                onMarkRead={onMarkRead}
                onClose={() => setShowNotifs(false)}
                onOpenContract={(id) => {
                  router.push(`/contracts/${id}`)
                  setShowNotifs(false)
                }}
              />
            )}
          </div>
          <Btn variant="primary" size="md" icon={Icon.Upload} onClick={onUpload}>
            <span className="hidden sm:inline">Plant a contract</span>
            <span className="sm:hidden">Plant</span>
          </Btn>
        </div>
      </div>
    </header>
  )
}

export function NotificationsPopover({
  notifications,
  onMarkRead,
  onClose,
  onOpenContract,
}: {
  notifications: CgNotification[]
  onMarkRead?: (id: string) => void
  onClose: () => void
  onOpenContract: (id: string) => void
}) {
  const unread = notifications.filter((n) => !n.read)
  const read = notifications.filter((n) => n.read)

  function Item({ n }: { n: CgNotification }) {
    const IconCmp = Icon[(n.icon as keyof typeof Icon) ?? 'Bell'] ?? Icon.Bell
    return (
      <li>
        <button
          onClick={() => {
            onMarkRead?.(n.id)
            if (n.contractId) onOpenContract(n.contractId)
            else onClose()
          }}
          className="w-full text-left px-3.5 py-3 hover:bg-black/[.02] transition flex items-start gap-3"
        >
          <span
            className="grid place-items-center w-7 h-7 rounded-md shrink-0 mt-0.5"
            style={{
              background:
                n.tone === 'critical'
                  ? 'var(--critical-bg)'
                  : n.tone === 'high'
                    ? 'var(--high-bg)'
                    : 'var(--primary-2)',
              color:
                n.tone === 'critical'
                  ? 'var(--critical)'
                  : n.tone === 'high'
                    ? 'var(--high)'
                    : 'var(--primary)',
            }}
          >
            <IconCmp size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="text-[13px] leading-snug"
              style={{ color: 'var(--ink)', fontWeight: n.read ? 400 : 500 }}
            >
              {n.title}
            </p>
            {n.body && (
              <p className="text-[12px] leading-snug mt-0.5" style={{ color: 'var(--ink-3)' }}>
                {n.body}
              </p>
            )}
            <p className="font-mono text-[10.5px] mt-1" style={{ color: 'var(--ink-3)' }}>
              {relativeTime(n.ts)}
            </p>
          </div>
          {!n.read && (
            <span
              className="w-2 h-2 rounded-full shrink-0 mt-1"
              style={{ background: 'var(--accent)' }}
            />
          )}
        </button>
      </li>
    )
  }

  return (
    <div
      className="absolute right-0 top-12 w-[360px] max-h-[480px] rounded-xl overflow-hidden flex flex-col anim-fade-up"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        boxShadow: '0 16px 50px rgba(40,30,10,0.22)',
      }}
    >
      <header
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--line)' }}
      >
        <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
          Notifications
        </p>
        {unread.length > 0 && (
          <button
            className="text-[11px] underline-offset-2 hover:underline"
            style={{ color: 'var(--ink-3)' }}
            onClick={() => unread.forEach((n) => onMarkRead?.(n.id))}
          >
            Mark all read
          </button>
        )}
      </header>
      <div className="overflow-y-auto scroll-thin flex-1">
        {notifications.length === 0 ? (
          <p className="text-center text-sm py-10" style={{ color: 'var(--ink-3)' }}>
            You&apos;re all caught up.
          </p>
        ) : (
          <>
            {unread.length > 0 && (
              <ul className="divide-y" style={{ borderColor: 'var(--line-2)' }}>
                {unread.map((n) => (
                  <Item key={n.id} n={n} />
                ))}
              </ul>
            )}
            {read.length > 0 && (
              <>
                <p
                  className="text-[10px] uppercase tracking-[0.14em] font-medium px-3.5 pt-3 pb-1.5"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Earlier
                </p>
                <ul>
                  {read.map((n) => (
                    <Item key={n.id} n={n} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function PageShell({
  children,
  currentRoute,
  onUpload,
  onOpenPalette,
  notifications,
  onMarkRead,
  narrow,
}: ChromeProps & {
  children: React.ReactNode
  currentRoute?: string
  narrow?: boolean
}) {
  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
      <TopBar
        onUpload={onUpload}
        onOpenPalette={onOpenPalette}
        currentRoute={currentRoute}
        notifications={notifications}
        onMarkRead={onMarkRead}
      />
      <main
        className={`${narrow ? 'max-w-[960px]' : 'max-w-[1200px]'} mx-auto px-6 md:px-10 pb-24 pt-8 relative`}
        style={{ zIndex: 1 }}
      >
        {children}
      </main>
    </div>
  )
}
