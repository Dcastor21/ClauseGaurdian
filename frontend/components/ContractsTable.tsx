'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useRouter } from 'next/navigation'
import { RiskBadge } from './RiskBadge'
import type { Contract } from '@/lib/api'

const RISK_BORDER: Record<string, string> = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#CA8A04',
  low: '#16A34A',
}

const STATUS_STYLES: Record<Contract['status'], string> = {
  processing: 'bg-gray-100 text-gray-600',
  analyzing:  'bg-blue-100 text-blue-600',
  complete:   'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-600',
}

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function SortHeader({ column, label }: { column: ReturnType<ReturnType<typeof useReactTable<Contract>>['getColumn']> & object; label: string }) {
  const sorted = column.getIsSorted()
  return (
    <button
      onClick={column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors focus:outline-none"
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp className="w-3 h-3 text-[#2563EB]" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="w-3 h-3 text-[#2563EB]" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-30" />
      )}
    </button>
  )
}

interface Props {
  contracts: Contract[]
  deletingId: string | null
  onDelete: (id: string) => void
}

export function ContractsTable({ contracts, deletingId, onDelete }: Props) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: ColumnDef<Contract, any>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <SortHeader column={column as never} label="Name" />,
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 block max-w-[200px] truncate">
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <SortHeader column={column as never} label="Uploaded" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-500 whitespace-nowrap">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <span className={clsx('rounded px-2 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[row.original.status])}>
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'overall_risk',
      header: ({ column }) => <SortHeader column={column as never} label="Risk" />,
      sortingFn: (rowA, rowB) => {
        const a = RISK_ORDER[rowA.original.overall_risk ?? ''] ?? 99
        const b = RISK_ORDER[rowB.original.overall_risk ?? ''] ?? 99
        return a - b
      },
      cell: ({ row }) => <RiskBadge risk={row.original.overall_risk} />,
    },
    {
      accessorKey: 'expires_at',
      header: ({ column }) => <SortHeader column={column as never} label="Expires" />,
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.expires_at ? new Date(rowA.original.expires_at).getTime() : Infinity
        const b = rowB.original.expires_at ? new Date(rowB.original.expires_at).getTime() : Infinity
        return a - b
      },
      cell: ({ row }) => {
        const days = daysUntil(row.original.expires_at)
        if (days === null) return <span className="font-mono text-xs text-gray-400">—</span>
        const urgent = days <= 7
        const warn = days <= 14 && days > 7
        return (
          <div className="flex items-center gap-2">
            <span className={clsx('font-mono text-xs', urgent ? 'text-red-600 font-semibold' : 'text-gray-500')}>
              {days >= 0 ? `${days}d` : 'Expired'}
            </span>
            {(urgent || warn) && (
              <span className={clsx('rounded px-1.5 py-0.5 text-xs font-medium', urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                {urgent ? '≤7d' : '≤14d'}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right">
          <button
            onClick={e => { e.stopPropagation(); onDelete(row.original.id) }}
            disabled={deletingId === row.original.id}
            aria-label={`Delete ${row.original.name}`}
            className="text-gray-400 hover:text-red-500 transition-colors p-2.5 rounded focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: contracts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <table className="hidden sm:table w-full text-sm">
      <thead>
        {table.getHeaderGroups().map(hg => (
          <tr key={hg.id} className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            {hg.headers.map(h => (
              <th key={h.id} scope="col" className="pb-3 font-medium">
                {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody className="divide-y divide-gray-100">
        {table.getRowModel().rows.map(row => (
          <tr
            key={row.id}
            tabIndex={0}
            className="hover:bg-gray-50 cursor-pointer transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]/50"
            onClick={() => router.push(`/contracts/${row.original.id}`)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') router.push(`/contracts/${row.original.id}`) }}
          >
            {row.getVisibleCells().map(cell => (
              <td
                key={cell.id}
                className="py-3 pr-4"
                style={
                  cell.column.id === 'name'
                    ? {
                        borderLeft: `3px solid ${
                          row.original.overall_risk
                            ? RISK_BORDER[row.original.overall_risk]
                            : 'transparent'
                        }`,
                      }
                    : undefined
                }
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
