'use client'

import { useState, useId } from 'react'
import { ChevronDown, ChevronUp, AlertCircle, FileText } from 'lucide-react'
import { clsx } from 'clsx'
import { RiskBadge } from './RiskBadge'
import type { Clause } from '../lib/api'

const TYPE_LABELS: Record<string, string> = {
  indemnification: 'Indemnification',
  ip_assignment: 'IP Assignment',
  auto_renewal: 'Auto-Renewal',
  liability_cap: 'Liability Cap',
  termination: 'Termination',
  confidentiality: 'Confidentiality',
  payment_terms: 'Payment Terms',
  governing_law: 'Governing Law',
}

export function ClauseCard({ clause }: { clause: Clause }) {
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()

  const typeLabel = TYPE_LABELS[clause.clause_type] ?? clause.clause_type

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* mobile: min-h-[44px] guarantees the toggle meets the minimum tap target */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
      >
        <div className="flex items-center gap-3 min-w-0">
          <RiskBadge risk={clause.severity} />
          <span className="text-sm font-medium text-gray-900 truncate">{typeLabel}</span>
          {clause.page_ref != null && (
            <span className="font-mono text-xs text-gray-400 shrink-0">p.{clause.page_ref}</span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-2" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div id={panelId} className="border-t border-gray-200 divide-y divide-gray-100">
          {/* Zone 1: Raw legal text */}
          {clause.raw_text && (
            <div className="px-4 py-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide flex items-center gap-1">
                <FileText className="w-3 h-3" aria-hidden="true" /> Contract Language
              </p>
              {/* mobile: break-words prevents long unbroken strings from causing horizontal overflow */}
              <p className="font-mono text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                {clause.raw_text}
              </p>
            </div>
          )}

          {/* Zone 2: Plain-language summary */}
          {clause.summary && (
            <div className="px-4 py-3 bg-white">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                What This Means
              </p>
              <p className="text-sm text-gray-800 leading-relaxed">{clause.summary}</p>
            </div>
          )}

          {/* Zone 3: Recommended action */}
          {clause.recommended_action && (
            <div className="px-4 py-3 bg-blue-50">
              <p className="text-xs font-semibold text-accent mb-2 uppercase tracking-wide">
                What To Do
              </p>
              <p className="text-sm text-blue-900 leading-relaxed">{clause.recommended_action}</p>
            </div>
          )}

          {/* Quick Tip */}
          <div className="px-4 py-3 bg-amber-50 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-amber-800">
              AI analysis is not legal advice. Consult a qualified attorney before acting on any
              clause.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
