'use client'

// components/cg/calendar.tsx — renewal calendar (cross-contract deadline view).
import * as React from 'react'
import { Icon } from './icons'
import { PageShell, type ChromeProps } from './topbar'
import { Avatar, SectionLabel } from './primitives'
import { daysUntil, type CgContract } from '@/lib/cg/data'
import type { ReminderEvent, SavedReminder } from './reminders'

interface CalEvent {
  id: string
  date: Date
  label: string
  note?: string | null
  urgency: string
  contract: CgContract
  kind: 'deadline' | 'expiry'
}

export function CalendarPage({
  contracts,
  onOpen,
  onSetReminder,
  reminders,
  ...chrome
}: ChromeProps & {
  contracts: CgContract[]
  onOpen: (id: string) => void
  onSetReminder?: (e: ReminderEvent) => void
  reminders?: SavedReminder[]
}) {
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const events: CalEvent[] = React.useMemo(() => {
    const e: CalEvent[] = []
    for (const c of contracts) {
      for (const d of c.deadlines ?? []) {
        e.push({
          id: `${c.id}-${d.id}`,
          date: new Date(d.date),
          label: d.label,
          note: d.note,
          urgency: d.urgency,
          contract: c,
          kind: 'deadline',
        })
      }
      if (
        c.expiresAt &&
        !(c.deadlines ?? []).some((d) => d.date.slice(0, 10) === c.expiresAt!.slice(0, 10))
      ) {
        e.push({
          id: `${c.id}-exp`,
          date: new Date(c.expiresAt),
          label: 'Contract expires',
          note: c.kind,
          urgency: 'high',
          contract: c,
          kind: 'expiry',
        })
      }
    }
    return e.sort((a, b) => +a.date - +b.date)
  }, [contracts])

  const months = React.useMemo(() => {
    const arr: { date: Date; events: CalEvent[] }[] = []
    for (let i = 0; i < 12; i++) {
      const m = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1)
      const monthEvents = events.filter(
        (e) => e.date.getFullYear() === m.getFullYear() && e.date.getMonth() === m.getMonth(),
      )
      arr.push({ date: m, events: monthEvents })
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  const upcoming = events
    .filter((e) => e.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .slice(0, 12)

  return (
    <PageShell currentRoute="calendar" {...chrome}>
      <div className="anim-fade-up">
        <p
          className="text-[11px] uppercase tracking-[0.16em] font-medium"
          style={{ color: 'var(--ink-3)' }}
        >
          Calendar
        </p>
        <h1
          className="font-display mt-1.5 text-[44px] md:text-[56px] leading-[1.12]"
          style={{ color: 'var(--ink)' }}
        >
          Your year, <em>at a glance.</em>
        </h1>
        <p
          className="text-[15px] leading-[1.6] mt-4 max-w-2xl"
          style={{ color: 'var(--ink-2)' }}
        >
          Every renewal notice, expiry, and milestone across your contracts — so nothing important
          slips by.
        </p>
      </div>

      <section className="mt-8">
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <div className="grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
            {months.map((m, i) => {
              const isCurrent =
                m.date.getMonth() === now.getMonth() &&
                m.date.getFullYear() === now.getFullYear()
              return (
                <div
                  key={i}
                  className="relative px-2 py-3 min-h-[120px] flex flex-col"
                  style={{
                    borderRight: i === 11 ? 'none' : '1px solid var(--line-2)',
                    background: isCurrent ? 'var(--primary-2)' : 'transparent',
                  }}
                >
                  <p
                    className="text-[10.5px] uppercase tracking-[0.14em] font-medium text-center"
                    style={{ color: isCurrent ? 'var(--primary)' : 'var(--ink-3)' }}
                  >
                    {m.date.toLocaleString('en-US', { month: 'short' })}
                  </p>
                  {isCurrent && (
                    <p
                      className="text-[9px] font-mono text-center mt-0.5"
                      style={{ color: 'var(--primary)' }}
                    >
                      NOW
                    </p>
                  )}

                  <div className="mt-3 flex-1 flex flex-col gap-1 items-center">
                    {m.events.map((ev) => {
                      const color =
                        ev.urgency === 'critical'
                          ? 'var(--critical)'
                          : ev.urgency === 'high'
                            ? 'var(--high)'
                            : ev.urgency === 'medium'
                              ? 'var(--medium)'
                              : 'var(--low)'
                      return (
                        <button
                          key={ev.id}
                          onClick={() => onOpen(ev.contract.id)}
                          title={`${ev.label} — ${ev.contract.counterparty} — ${ev.date.toLocaleDateString()}`}
                          className="w-full text-center transition hover:opacity-90"
                        >
                          <span
                            className="block w-full h-1 rounded-sm"
                            style={{ background: color }}
                          />
                        </button>
                      )
                    })}
                  </div>

                  <p
                    className="text-center font-mono text-[10px] mt-2"
                    style={{ color: m.events.length ? 'var(--ink-2)' : 'var(--ink-3)' }}
                  >
                    {m.events.length || '·'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <div
          className="mt-3 flex items-center gap-4 flex-wrap text-[11.5px]"
          style={{ color: 'var(--ink-3)' }}
        >
          {[
            { label: 'Critical', color: 'var(--critical)' },
            { label: 'High', color: 'var(--high)' },
            { label: 'Medium', color: 'var(--medium)' },
            { label: 'Low', color: 'var(--low)' },
          ].map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-sm" style={{ background: l.color }} /> {l.label}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <SectionLabel kicker="Next up" subtitle="Upcoming dates, in order" />
          <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            {upcoming.length} item{upcoming.length === 1 ? '' : 's'}
          </span>
        </div>

        {upcoming.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: 'var(--surface)', border: '1px dashed var(--line)' }}
          >
            <Icon.Calendar
              size={20}
              className="mx-auto mb-2"
              style={{ color: 'var(--ink-3)' }}
            />
            <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
              Nothing on your calendar. Quiet stretch ahead.
            </p>
          </div>
        ) : (
          <ol className="relative">
            <span
              className="absolute left-[18px] top-2 bottom-2 w-px"
              style={{ background: 'var(--line)' }}
            />
            {upcoming.map((ev) => {
              const days = daysUntil(ev.date.toISOString())!
              const urgent = days <= 14
              const color =
                ev.urgency === 'critical'
                  ? 'var(--critical)'
                  : ev.urgency === 'high'
                    ? 'var(--high)'
                    : ev.urgency === 'medium'
                      ? 'var(--medium)'
                      : 'var(--primary)'
              return (
                <li key={ev.id} className="relative pl-12 pb-5 last:pb-0">
                  <span
                    className="absolute left-2 top-3 w-4 h-4 rounded-full grid place-items-center"
                    style={{
                      background: 'var(--surface)',
                      border: `2px solid ${color}`,
                    }}
                  />
                  <div
                    className="w-full text-left rounded-lg p-4 transition group"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <button
                        onClick={() => onOpen(ev.contract.id)}
                        className="text-left min-w-0 flex-1"
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className="font-mono text-xs"
                            style={{ color: urgent ? 'var(--critical)' : 'var(--ink-2)' }}
                          >
                            {ev.date.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span
                            className="font-mono text-xs"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            · in {days}d
                          </span>
                          {urgent && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium"
                              style={{
                                background: 'var(--critical-bg)',
                                color: 'var(--critical)',
                              }}
                            >
                              Urgent
                            </span>
                          )}
                          {reminders?.some((r) => r.eventId === ev.id) && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium"
                              style={{ color: 'var(--primary)' }}
                            >
                              <Icon.Bell size={10} /> Reminder set
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[14.5px] font-medium leading-snug mt-1"
                          style={{ color: 'var(--ink)' }}
                        >
                          {ev.label}
                        </p>
                        {ev.note && (
                          <p
                            className="text-[12px] leading-snug mt-0.5"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {ev.note}
                          </p>
                        )}
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={ev.contract.counterparty} size={26} />
                          <div className="min-w-0">
                            <p
                              className="text-[12px] font-medium truncate max-w-[180px]"
                              style={{ color: 'var(--ink)' }}
                            >
                              {ev.contract.counterparty}
                            </p>
                            <p
                              className="text-[10.5px] truncate"
                              style={{ color: 'var(--ink-3)' }}
                            >
                              {ev.contract.kind}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSetReminder?.({
                              id: ev.id,
                              label: ev.label,
                              date: ev.date.toISOString(),
                              contract: {
                                counterparty: ev.contract.counterparty,
                                kind: ev.contract.kind,
                              },
                            })
                          }}
                          className="grid place-items-center w-8 h-8 rounded-md transition hover:bg-black/5"
                          style={{ color: 'var(--ink-3)' }}
                          aria-label="Set reminder"
                        >
                          <Icon.Bell size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </PageShell>
  )
}
