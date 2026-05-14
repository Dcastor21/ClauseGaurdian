'use client'

import { Suspense, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { UserProfile } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Shield } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { getMe, updatePreferences, type UserProfile as UserProfileData, type AlertPreferences } from '@/lib/api'

const ALERT_WINDOWS = [30, 14, 7, 1] as const

// ── Notifications tab ──────────────────────────────────────────────────────

function NotificationsTab({
  prefs,
  saving,
  onChange,
}: {
  prefs: AlertPreferences
  saving: boolean
  onChange: (patch: Partial<AlertPreferences>) => void
}) {
  const windows = prefs.windows ?? [30, 14, 7, 1]

  function toggleWindow(days: number) {
    const next = windows.includes(days)
      ? windows.filter((w) => w !== days)
      : [...windows, days].sort((a, b) => b - a)
    onChange({ windows: next })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {/* Email */}
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-gray-900 text-sm">Email alerts</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Deadline reminder emails sent to your account address.
            </p>
          </div>
          <Switch
            checked={prefs.email}
            onCheckedChange={(checked) => onChange({ email: checked })}
            aria-label="Email alerts"
          />
        </div>

        {prefs.email && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Remind me
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ALERT_WINDOWS.map((days) => (
                <label
                  key={days}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={windows.includes(days)}
                    onChange={() => toggleWindow(days)}
                    className="h-4 w-4 rounded border-gray-300 accent-[#2563EB] cursor-pointer"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                    {days} days before
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Push */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-gray-900 text-sm">Push alerts</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Instant push notification when a critical or high-risk clause is found.
            </p>
          </div>
          <Switch
            checked={prefs.push}
            onCheckedChange={(checked) => onChange({ push: checked })}
            aria-label="Push alerts"
          />
        </div>
      </div>

      {saving && (
        <div className="px-6 py-3 text-xs text-gray-400">Saving…</div>
      )}
    </div>
  )
}

// ── Plan tab ───────────────────────────────────────────────────────────────

function PlanTab({ me }: { me: UserProfileData }) {
  const used = me.contracts_this_month
  const limit = me.monthly_limit
  const pct = Math.min((used / limit) * 100, 100)

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="p-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Current plan
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xl font-bold text-gray-900 capitalize">{me.plan}</p>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 capitalize">
              {me.plan}
            </span>
          </div>
        </div>
        <Shield className="w-8 h-8 text-accent shrink-0" />
      </div>

      <div className="p-6 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Contracts this month</p>
          <p className="font-mono text-sm text-gray-900">
            {used} <span className="text-gray-400">/ {limit}</span>
          </p>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-1.5 rounded-full bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">{limit - used} remaining this month</p>
      </div>

      <div className="p-6 space-y-3">
        <p className="text-sm text-gray-500">
          Upgrade to Pro for unlimited contracts, faster analysis, and priority support.
        </p>
        <button
          disabled
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white opacity-40 cursor-not-allowed"
        >
          Upgrade to Pro — coming soon
        </button>
      </div>
    </div>
  )
}

// ── Inner page (needs useSearchParams → must be in Suspense) ───────────────

function SettingsInner() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'account'

  const [me, setMe] = useState<UserProfileData | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.push('/sign-in'); return }

    getToken().then((token) => {
      if (!token) return
      getMe(token).then(setMe).catch(() => {})
    })
  }, [isLoaded, isSignedIn, getToken, router])

  async function handlePrefChange(patch: Partial<AlertPreferences>) {
    if (!me) return
    // Optimistic update
    setMe((prev) =>
      prev ? { ...prev, alert_preferences: { ...prev.alert_preferences, ...patch } } : prev,
    )
    const token = await getToken()
    if (!token) return
    setSaving(true)
    try {
      const result = await updatePreferences(token, patch)
      setMe((prev) => (prev ? { ...prev, alert_preferences: result.alert_preferences } : prev))
    } finally {
      setSaving(false)
    }
  }

  const defaultPrefs: AlertPreferences = { email: true, push: true, windows: [30, 14, 7, 1] }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard')}
          aria-label="Back to dashboard"
          className="text-gray-400 hover:text-gray-700 transition-colors p-2 rounded focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" aria-hidden="true" />
          <h1 className="text-base font-semibold text-gray-900">Settings</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        {/* Vertical on desktop, stacked on mobile */}
        <Tabs
          orientation="vertical"
          value={tab}
          onValueChange={(val) =>
            router.replace(`/settings?tab=${val}`, { scroll: false })
          }
          className="flex-col md:flex-row gap-6"
        >
          <TabsList className="w-full md:w-48 bg-white border border-gray-200 h-auto p-1.5">
            <TabsTrigger value="account" className="w-full justify-start px-3 py-2 text-sm">
              Account
            </TabsTrigger>
            <TabsTrigger value="notifications" className="w-full justify-start px-3 py-2 text-sm">
              Notifications
            </TabsTrigger>
            <TabsTrigger value="plan" className="w-full justify-start px-3 py-2 text-sm">
              Plan
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-w-0">
            <TabsContent value="account" className="mt-0">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <UserProfile
                  appearance={{
                    variables: {
                      colorPrimary: '#2563EB',
                      colorBackground: '#ffffff',
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      borderRadius: '0.5rem',
                    },
                    elements: {
                      rootBox: 'w-full',
                      card: 'shadow-none w-full',
                      navbar: 'border-r border-gray-100',
                    },
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              {me ? (
                <NotificationsTab
                  prefs={me.alert_preferences ?? defaultPrefs}
                  saving={saving}
                  onChange={handlePrefChange}
                />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse space-y-4">
                  <div className="h-4 bg-gray-100 rounded w-32" />
                  <div className="h-4 bg-gray-100 rounded w-48" />
                </div>
              )}
            </TabsContent>

            <TabsContent value="plan" className="mt-0">
              {me ? (
                <PlanTab me={me} />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse space-y-4">
                  <div className="h-6 bg-gray-100 rounded w-24" />
                  <div className="h-4 bg-gray-100 rounded w-48" />
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

// ── Page export ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  )
}
