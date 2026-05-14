'use client'

import { Check, ChevronDown, X } from 'lucide-react'
import { clsx } from 'clsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const RISK_OPTIONS = [
  { value: 'critical', label: 'Critical', chip: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'high',     label: 'High',     chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'medium',   label: 'Medium',   chip: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'low',      label: 'Low',      chip: 'bg-green-50 text-green-700 border-green-200' },
]

interface Props {
  value: string[]
  onChange: (value: string[]) => void
}

export function RiskFilter({ value, onChange }: Props) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover>
        <PopoverTrigger
          className="inline-flex items-center gap-1.5 border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 shrink-0"
          aria-label="Filter by risk level"
        >
          Risk
          {value.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#2563EB] text-white text-[10px] font-bold leading-none">
              {value.length}
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </PopoverTrigger>

        <PopoverContent className="w-44 p-1" align="start" side="bottom">
          {RISK_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors text-left"
            >
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded border border-gray-200 bg-white shrink-0"
                aria-hidden="true"
              >
                {value.includes(opt.value) && <Check className="w-3 h-3 text-gray-700" />}
              </span>
              <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded border', opt.chip)}>
                {opt.label}
              </span>
            </button>
          ))}

          {value.length > 0 && (
            <>
              <div className="h-px bg-gray-100 mx-1 my-1" />
              <button
                onClick={() => onChange([])}
                className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded text-xs text-gray-400 hover:bg-gray-50 transition-colors"
              >
                Clear filters
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>

      {value.map(v => {
        const opt = RISK_OPTIONS.find(o => o.value === v)!
        return (
          <span
            key={v}
            className={clsx(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border',
              opt.chip,
            )}
          >
            {opt.label}
            <button
              onClick={() => toggle(v)}
              aria-label={`Remove ${opt.label} filter`}
              className="ml-0.5 hover:opacity-70 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}
