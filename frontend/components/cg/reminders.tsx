'use client'

// components/cg/reminders.tsx — set a custom reminder for a deadline / date.
import * as React from 'react'
import { Icon } from './icons'
import { Btn } from './primitives'
import { formatDate } from '@/lib/cg/data'

export interface ReminderEvent {
  id: string
  label: string
  date: string
  contract?: { counterparty?: string | null; kind?: string | null }
}

export interface SavedReminder {
  eventId: string
  date?: string
  channels: { email: boolean; push: boolean }
  note: string
}

export function RemindersModal({
  open,
  onClose,
  event,
  onSave,
}: {
  open: boolean
  onClose: () => void
  event: ReminderEvent | null
  onSave?: (r: SavedReminder) => void
}) {
  const [preset, setPreset] = React.useState('30')
  const [customDate, setCustomDate] = React.useState('')
  const [channels, setChannels] = React.useState({ email: true, push: false })
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setPreset('30')
      setCustomDate('')
      setNote('')
      setChannels({ email: true, push: false })
    }
  }, [open])

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !event) return null

  function reminderDate(): Date | null {
    if (preset === 'custom' && customDate) return new Date(customDate)
    if (preset === 'custom') return null
    const target = new Date(event!.date)
    target.setDate(target.getDate() - Number(preset))
    return target
  }
  const remindDate = reminderDate()
  const remindDays = remindDate
    ? Math.ceil((+remindDate - Date.now()) / 86400000)
    : null
  const isPast = !!remindDate && remindDate < new Date()

  function save() {
    onSave?.({
      eventId: event!.id,
      date: remindDate?.toISOString(),
      channels,
      note,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 overflow-y-auto"
      style={{ background: 'color-mix(in oklch, var(--ink) 50%, transparent)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[460px] rounded-2xl my-8 anim-fade-up"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          boxShadow: '0 24px 80px rgba(40,30,10,0.25)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-md hover:bg-black/5 transition z-10"
          style={{ color: 'var(--ink-3)' }}
        >
          <Icon.X size={16} />
        </button>

        <div className="p-7">
          <p
            className="text-[11px] uppercase tracking-[0.16em] font-medium"
            style={{ color: 'var(--primary)' }}
          >
            Set a reminder
          </p>
          <h2
            className="font-display text-[26px] leading-[1.22] mt-1.5"
            style={{ color: 'var(--ink)' }}
          >
            Before <em>{event.label}</em>
          </h2>
          <p
            className="text-[13px] leading-relaxed mt-2"
            style={{ color: 'var(--ink-2)' }}
          >
            <span className="font-mono">{formatDate(event.date)}</span> ·{' '}
            {event.contract?.counterparty}
          </p>

          <div className="mt-6">
            <p
              className="text-[10.5px] uppercase tracking-[0.14em] font-medium mb-2.5"
              style={{ color: 'var(--ink-3)' }}
            >
              Remind me
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { key: '7', label: '1 wk' },
                { key: '14', label: '2 wks' },
                { key: '30', label: '30 d' },
                { key: '60', label: '60 d' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className="rounded-md py-2 text-[12.5px] font-medium transition"
                  style={
                    preset === p.key
                      ? { background: 'var(--primary)', color: 'white' }
                      : {
                          background: 'var(--surface-2)',
                          color: 'var(--ink-2)',
                          border: '1px solid var(--line)',
                        }
                  }
                >
                  {p.label} before
                </button>
              ))}
            </div>
            <button
              onClick={() => setPreset('custom')}
              className="text-[11.5px] mt-2.5 inline-flex items-center gap-1 hover:underline underline-offset-2"
              style={{ color: preset === 'custom' ? 'var(--primary)' : 'var(--ink-3)' }}
            >
              {preset === 'custom' ? '✓ ' : '+ '}Pick a specific date
            </button>
            {preset === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="mt-2 w-full rounded-md px-3 py-2 text-[14px] outline-none"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                }}
              />
            )}
          </div>

          <div className="mt-5">
            <p
              className="text-[10.5px] uppercase tracking-[0.14em] font-medium mb-2.5"
              style={{ color: 'var(--ink-3)' }}
            >
              How
            </p>
            <div className="flex items-center gap-2">
              <ChannelToggle
                label="Email"
                value={channels.email}
                onChange={(v) => setChannels((c) => ({ ...c, email: v }))}
                icon={Icon.Send}
              />
              <ChannelToggle
                label="In-app"
                value={channels.push}
                onChange={(v) => setChannels((c) => ({ ...c, push: v }))}
                icon={Icon.Bell}
              />
            </div>
          </div>

          <div className="mt-5">
            <p
              className="text-[10.5px] uppercase tracking-[0.14em] font-medium mb-2.5"
              style={{ color: 'var(--ink-3)' }}
            >
              Note{' '}
              <span className="opacity-60 normal-case tracking-normal font-normal">
                (optional)
              </span>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What to do when reminded (e.g. 'send non-renewal email')…"
              className="w-full rounded-md px-3 py-2 text-[13px] leading-[1.5] outline-none resize-none placeholder:opacity-60"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
              }}
            />
          </div>

          {remindDate && !isPast && (
            <div
              className="mt-5 rounded-lg p-3 flex items-start gap-2.5"
              style={{ background: 'var(--primary-2)' }}
            >
              <Icon.Bell
                size={13}
                className="shrink-0 mt-0.5"
                style={{ color: 'var(--primary)' }}
              />
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                We&apos;ll remind you on{' '}
                <span className="font-mono" style={{ color: 'var(--ink)' }}>
                  {formatDate(remindDate.toISOString())}
                </span>
                {remindDays != null && remindDays > 0 && (
                  <>
                    {' '}
                    ({remindDays} {remindDays === 1 ? 'day' : 'days'} from now)
                  </>
                )}
                .
              </p>
            </div>
          )}
          {isPast && (
            <div
              className="mt-5 rounded-lg p-3 flex items-start gap-2.5"
              style={{ background: 'var(--critical-bg)' }}
            >
              <Icon.AlertCircle
                size={13}
                className="shrink-0 mt-0.5"
                style={{ color: 'var(--critical)' }}
              />
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--critical)' }}>
                That reminder date is in the past. Pick a different preset or date.
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center gap-2 justify-end">
            <Btn variant="soft" onClick={onClose}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              icon={Icon.Bell}
              onClick={save}
              disabled={!remindDate || isPast}
            >
              Set reminder
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChannelToggle({
  label,
  value,
  onChange,
  icon: IconCmp,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  icon: React.ComponentType<{ size?: number }>
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition"
      style={
        value
          ? {
              background: 'var(--primary-2)',
              color: 'var(--primary)',
              border: '1px solid color-mix(in oklch, var(--primary) 22%, transparent)',
            }
          : {
              background: 'var(--surface-2)',
              color: 'var(--ink-3)',
              border: '1px solid var(--line)',
            }
      }
    >
      {value ? <Icon.Check size={12} /> : <IconCmp size={12} />}
      {label}
    </button>
  )
}
