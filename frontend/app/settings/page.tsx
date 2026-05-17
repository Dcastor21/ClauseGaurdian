'use client'

import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { SettingsPage } from '@/components/cg/settings'
import { useCgChrome } from '@/components/cg/chrome'
import {
  getMe,
  updatePreferences,
  type UserProfile,
  type AlertPreferences,
} from '@/lib/api'

export default function Settings() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const router = useRouter()

  const [me, setMe] = useState<UserProfile | null>(null)
  const [saving, setSaving] = useState(false)

  const { onUpload, onOpenPalette, modals } = useCgChrome({ contracts: [] })

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }
    getToken().then((token) => {
      if (!token) return
      getMe(token).then(setMe).catch(() => {})
    })
  }, [isLoaded, isSignedIn, getToken, router])

  async function onPrefChange(patch: Partial<AlertPreferences>) {
    setMe((prev) =>
      prev
        ? { ...prev, alert_preferences: { ...prev.alert_preferences, ...patch } }
        : prev,
    )
    const token = await getToken()
    if (!token) return
    setSaving(true)
    try {
      const result = await updatePreferences(token, patch)
      setMe((prev) =>
        prev ? { ...prev, alert_preferences: result.alert_preferences } : prev,
      )
    } finally {
      setSaving(false)
    }
  }

  const account = {
    name: user?.fullName ?? '',
    email: user?.primaryEmailAddress?.emailAddress ?? me?.email ?? '',
    business: (user?.publicMetadata?.business as string) ?? '',
  }

  return (
    <>
      <SettingsPage
        account={account}
        prefs={me?.alert_preferences ?? null}
        saving={saving}
        onPrefChange={onPrefChange}
        onUpload={onUpload}
        onOpenPalette={onOpenPalette}
        notifications={[]}
        onMarkRead={() => {}}
      />
      {modals}
    </>
  )
}
