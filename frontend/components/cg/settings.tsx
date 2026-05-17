'use client'

// components/cg/settings.tsx — Settings: Account / Notifications / Billing.
// The Notifications tab's deadline-email, reminder window and in-app push are
// wired to the real backend (lib/api preferences); the remaining toggles are
// UI-only preferences with no backend field yet (as in the design source).
import * as React from 'react'
import { Icon } from './icons'
import { PageShell, type ChromeProps } from './topbar'
import { Avatar, Btn } from './primitives'

export interface SettingsAccount {
  name: string
  email: string
  business: string
}

export interface SettingsPrefs {
  email: boolean
  push: boolean
  windows: number[]
}

export function SettingsPage({
  account,
  prefs,
  saving,
  onPrefChange,
  ...chrome
}: ChromeProps & {
  account: SettingsAccount
  prefs: SettingsPrefs | null
  saving?: boolean
  onPrefChange: (patch: Partial<SettingsPrefs>) => void
}) {
  const [tab, setTab] = React.useState<'account' | 'notifications' | 'billing'>('account')

  return (
    <PageShell currentRoute="settings" narrow {...chrome}>
      <div className="anim-fade-up">
        <p
          className="text-[11px] uppercase tracking-[0.16em] font-medium"
          style={{ color: 'var(--ink-3)' }}
        >
          Settings
        </p>
        <h1
          className="font-display mt-1.5 text-[40px] md:text-[48px] leading-[1.15]"
          style={{ color: 'var(--ink)' }}
        >
          Your account.
        </h1>
      </div>

      <div
        className="mt-8 flex items-center gap-1 border-b"
        style={{ borderColor: 'var(--line)' }}
      >
        {(
          [
            { key: 'account', label: 'Account', icon: Icon.FileText },
            { key: 'notifications', label: 'Notifications', icon: Icon.Bell },
            { key: 'billing', label: 'Billing', icon: Icon.Hash },
          ] as const
        ).map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 -mb-px text-[13px] font-medium transition relative"
              style={{ color: active ? 'var(--ink)' : 'var(--ink-3)' }}
            >
              <t.icon size={13} />
              {t.label}
              {active && (
                <span
                  className="absolute left-0 right-0 -bottom-px h-[2px] rounded-t-sm"
                  style={{ background: 'var(--primary)' }}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-8 anim-fade-up" key={tab}>
        {tab === 'account' && <AccountTab account={account} />}
        {tab === 'notifications' && (
          <NotificationsTab prefs={prefs} saving={saving} onPrefChange={onPrefChange} />
        )}
        {tab === 'billing' && <BillingTab />}
      </div>
    </PageShell>
  )
}

function AccountTab({ account }: { account: SettingsAccount }) {
  return (
    <div className="space-y-7">
      <SettingsCard title="Profile" sub="How you appear in comments and counter-proposals.">
        <div className="flex items-center gap-5">
          <Avatar name={account.name || account.email} size={64} />
          <div className="space-y-2">
            <Btn variant="soft" size="sm">
              Change photo
            </Btn>
            <p className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              JPG or PNG · square · max 1 MB
            </p>
          </div>
        </div>
        <Field label="Name" value={account.name} sub="Managed by your Clerk profile." readOnly />
        <Field
          label="Business / DBA"
          value={account.business}
          sub="Used in the closing of counter-proposal emails."
          readOnly
        />
        <Field
          label="Email"
          value={account.email}
          sub="Where we send weekly digests and renewal reminders."
          readOnly
        />
      </SettingsCard>

      <SettingsCard title="Workspace" sub="Where you've planted contracts.">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>
              {account.business || 'Your workspace'}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              Personal workspace
            </p>
          </div>
          <Btn variant="soft" size="sm">
            Manage members
          </Btn>
        </div>
      </SettingsCard>

      <SettingsCard title="Danger zone" tone="danger">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>
              Delete your account
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              Removes all contracts, analyses, and comments. Cannot be undone.
            </p>
          </div>
          <Btn variant="danger" size="sm" icon={Icon.Trash}>
            Delete account
          </Btn>
        </div>
      </SettingsCard>
    </div>
  )
}

const STD_WINDOWS = [30, 14, 7, 1]

function NotificationsTab({
  prefs,
  saving,
  onPrefChange,
}: {
  prefs: SettingsPrefs | null
  saving?: boolean
  onPrefChange: (patch: Partial<SettingsPrefs>) => void
}) {
  const [local, setLocal] = React.useState({
    weekly_digest: true,
    analysis_complete: true,
    comments_email: true,
    failed_uploads: true,
    marketing: false,
    sound: false,
  })
  const setL = (k: keyof typeof local, v: boolean) => setLocal((s) => ({ ...s, [k]: v }))

  const emailOn = prefs?.email ?? true
  const pushOn = prefs?.push ?? true
  const primaryWindow = prefs?.windows?.[0] ?? 30

  return (
    <div className="space-y-7">
      <SettingsCard title="Email" sub="What we send to your inbox.">
        <Toggle
          label="Weekly digest"
          sub="A Monday summary of what needs your eyes this week."
          value={local.weekly_digest}
          onChange={(v) => setL('weekly_digest', v)}
        />
        <Toggle
          label="Deadline reminders"
          sub="Before any renewal, expiry, or notice deadline."
          value={emailOn}
          onChange={(v) => onPrefChange({ email: v })}
        />
        {emailOn && (
          <div
            className="flex items-center gap-3 pl-4 ml-1 border-l"
            style={{ borderColor: 'var(--line)' }}
          >
            <span className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
              Remind me
            </span>
            <select
              value={primaryWindow}
              onChange={(e) =>
                onPrefChange({
                  windows: [Number(e.target.value), ...STD_WINDOWS].filter(
                    (v, i, a) => a.indexOf(v) === i,
                  ),
                })
              }
              className="rounded-md px-2 py-1 text-[12px] font-medium outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
              }}
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} days before
                </option>
              ))}
            </select>
          </div>
        )}
        <Toggle
          label="Analysis complete"
          sub="When a contract finishes processing."
          value={local.analysis_complete}
          onChange={(v) => setL('analysis_complete', v)}
        />
        <Toggle
          label="New comments"
          sub="When your advisor or co-founder replies."
          value={local.comments_email}
          onChange={(v) => setL('comments_email', v)}
        />
        <Toggle
          label="Failed uploads"
          sub="When we can't read a file."
          value={local.failed_uploads}
          onChange={(v) => setL('failed_uploads', v)}
        />
        <Toggle
          label="Product updates"
          sub="Occasional notes when we ship something useful."
          value={local.marketing}
          onChange={(v) => setL('marketing', v)}
        />
      </SettingsCard>

      <SettingsCard title="In-app" sub="Notification behavior.">
        <Toggle
          label="Push notifications"
          sub="Instant alert when a critical or high-risk clause is found."
          value={pushOn}
          onChange={(v) => onPrefChange({ push: v })}
        />
        <Toggle
          label="Play sound on new comment"
          sub="A small chime when someone replies."
          value={local.sound}
          onChange={(v) => setL('sound', v)}
        />
      </SettingsCard>

      {saving && (
        <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
          Saving…
        </p>
      )}
    </div>
  )
}

function BillingTab() {
  return (
    <div className="space-y-7">
      <div
        className="rounded-xl p-6 flex items-start justify-between gap-4 flex-wrap"
        style={{
          background: 'var(--primary-2)',
          border: '1px solid color-mix(in oklch, var(--primary) 22%, transparent)',
        }}
      >
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--primary)' }}
          >
            Current plan
          </p>
          <p
            className="font-display text-[28px] leading-tight mt-1.5"
            style={{ color: 'var(--ink)' }}
          >
            Gardener
          </p>
          <p className="text-[13px] mt-2 max-w-md" style={{ color: 'var(--ink-2)' }}>
            Up to 25 contracts, advisor seat included, weekly digests. $19/mo, billed annually.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="font-mono text-[12px]" style={{ color: 'var(--ink-2)' }}>
            $228.00 / yr
          </p>
          <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            Renews Jan 9, 2027
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            name: 'Sprout',
            price: 'Free',
            desc: 'Up to 3 contracts. No advisor seat.',
            current: false,
          },
          {
            name: 'Gardener',
            price: '$19/mo',
            desc: 'Up to 25 contracts, weekly digest, 1 advisor seat.',
            current: true,
          },
          {
            name: 'Grove',
            price: '$49/mo',
            desc: 'Unlimited contracts, 5 seats, version history, priority.',
            current: false,
          },
        ].map((p) => (
          <div
            key={p.name}
            className="rounded-xl p-5 flex flex-col"
            style={{
              background: 'var(--surface)',
              border: p.current ? '1.5px solid var(--primary)' : '1px solid var(--line)',
            }}
          >
            <p className="font-display text-[20px]" style={{ color: 'var(--ink)' }}>
              {p.name}
            </p>
            <p className="font-mono text-[14px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
              {p.price}
            </p>
            <p
              className="text-[12px] leading-snug mt-3 flex-1"
              style={{ color: 'var(--ink-3)' }}
            >
              {p.desc}
            </p>
            <div className="mt-4">
              {p.current ? (
                <span
                  className="inline-flex items-center gap-1.5 text-[11.5px] uppercase tracking-wider font-medium"
                  style={{ color: 'var(--primary)' }}
                >
                  <Icon.Check size={12} /> Current plan
                </span>
              ) : (
                <Btn
                  variant="soft"
                  size="sm"
                  className="w-full"
                  style={{ justifyContent: 'center' }}
                >
                  {p.name === 'Sprout' ? 'Downgrade' : 'Upgrade'}
                </Btn>
              )}
            </div>
          </div>
        ))}
      </div>

      <SettingsCard title="Payment method">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-10 h-7 rounded font-mono text-[10px] font-semibold"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              VISA
            </span>
            <div>
              <p className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>
                •••• 4242
              </p>
              <p className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                Expires 09 / 27
              </p>
            </div>
          </div>
          <Btn variant="soft" size="sm">
            Update
          </Btn>
        </div>
      </SettingsCard>

      <SettingsCard title="Invoice history">
        <ul className="divide-y" style={{ borderColor: 'var(--line-2)' }}>
          {[
            { date: 'Jan 9, 2026', amount: '$228.00', invoice: 'INV-1024', status: 'Paid' },
            { date: 'Jan 9, 2025', amount: '$228.00', invoice: 'INV-0871', status: 'Paid' },
            {
              date: 'Jan 9, 2024',
              amount: '$108.00',
              invoice: 'INV-0512',
              status: 'Paid',
              note: 'Sprout → Gardener mid-year',
            },
          ].map((inv, i) => (
            <li key={i} className="py-3 flex items-center gap-3">
              <Icon.FileText size={14} style={{ color: 'var(--ink-3)' }} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px]" style={{ color: 'var(--ink)' }}>
                  {inv.date}
                </p>
                <p className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {inv.invoice}
                  {inv.note ? ` · ${inv.note}` : ''}
                </p>
              </div>
              <span
                className="font-mono text-[12.5px]"
                style={{ color: 'var(--ink-2)' }}
              >
                {inv.amount}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                style={{ background: 'var(--low-bg)', color: 'var(--low)' }}
              >
                {inv.status}
              </span>
              <button
                className="text-[11.5px] underline-offset-2 hover:underline"
                style={{ color: 'var(--ink-3)' }}
              >
                Download
              </button>
            </li>
          ))}
        </ul>
      </SettingsCard>
    </div>
  )
}

function SettingsCard({
  title,
  sub,
  children,
  tone,
}: {
  title?: string
  sub?: string
  children: React.ReactNode
  tone?: 'danger'
}) {
  return (
    <section
      className="rounded-xl p-6"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${
          tone === 'danger'
            ? 'color-mix(in oklch, var(--critical) 25%, var(--line))'
            : 'var(--line)'
        }`,
      }}
    >
      {title && (
        <header className="mb-4">
          <p
            className="text-[13.5px] font-medium"
            style={{ color: tone === 'danger' ? 'var(--critical)' : 'var(--ink)' }}
          >
            {title}
          </p>
          {sub && (
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              {sub}
            </p>
          )}
        </header>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  value,
  sub,
  readOnly,
}: {
  label: string
  value: string
  sub?: string
  readOnly?: boolean
}) {
  return (
    <label className="block">
      <span
        className="text-[11px] uppercase tracking-[0.14em] font-medium"
        style={{ color: 'var(--ink-3)' }}
      >
        {label}
      </span>
      <input
        value={value}
        readOnly={readOnly}
        className="mt-1.5 w-full rounded-md px-3 py-2 text-[14px] outline-none transition"
        style={{
          background: 'var(--surface-2)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
        }}
      />
      {sub && (
        <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
          {sub}
        </p>
      )}
    </label>
  )
}

function Toggle({
  label,
  sub,
  value,
  onChange,
}: {
  label: string
  sub?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium" style={{ color: 'var(--ink)' }}>
          {label}
        </p>
        {sub && (
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
            {sub}
          </p>
        )}
      </div>
      <span
        className="shrink-0 relative inline-block w-10 h-6 rounded-full transition"
        role="switch"
        aria-checked={value}
        style={{ background: value ? 'var(--primary)' : 'var(--line)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform"
          style={{
            background: 'var(--surface)',
            transform: value ? 'translateX(16px)' : 'translateX(0)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}
        />
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
      </span>
    </label>
  )
}
