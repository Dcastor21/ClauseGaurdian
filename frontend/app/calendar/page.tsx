'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPage } from '@/components/cg/calendar'
import { RemindersModal, type ReminderEvent, type SavedReminder } from '@/components/cg/reminders'
import { useCgChrome } from '@/components/cg/chrome'
import { useDetailedContracts } from '@/components/cg/use-detailed'

export default function Calendar() {
  const router = useRouter()
  const { contracts, notifications, markRead } = useDetailedContracts()
  const { onUpload, onOpenPalette, modals } = useCgChrome({ contracts })

  const [reminderEvent, setReminderEvent] = useState<ReminderEvent | null>(null)
  const [reminders, setReminders] = useState<SavedReminder[]>([])

  return (
    <>
      <CalendarPage
        contracts={contracts}
        onOpen={(id) => router.push(`/contracts/${id}`)}
        onUpload={onUpload}
        onOpenPalette={onOpenPalette}
        notifications={notifications}
        onMarkRead={markRead}
        onSetReminder={setReminderEvent}
        reminders={reminders}
      />
      <RemindersModal
        open={!!reminderEvent}
        event={reminderEvent}
        onClose={() => setReminderEvent(null)}
        onSave={(r) => setReminders((s) => [...s, r])}
      />
      {modals}
    </>
  )
}
