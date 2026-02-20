'use client'
import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight,
  Trash2, Pencil, Phone, Download,
  CheckCircle2, Circle
} from 'lucide-react'
import { Lead, computeBantScore, bantScoreLabel } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface LeadsTableProps {
  leads: Lead[]
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
  onRefresh: () => void
  globalFilter: string
}

function NeedBadge({ level }: { level: number | null }) {
  if (!level) return <span className="text-[#475569]">—</span>
  const colors = ['', '#64748b', '#22d3ee', '#facc15', '#f97316', '#ef4444']
  const labels = ['', '❄️ 1', '🌊 2', '🔥 3', '⚡ 4', '💥 5']
  return (
    <span className="badge" style={{ background: `${colors[level]}18`, color: colors[level], border: `1px solid ${colors[level]}44` }}>
      {labels[level]}
    </span>
  )
}

function ResponseBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[#475569]">—</span>
  const map: Record<string, string> = {
    'No response': 'badge-cold',
    'Interested': 'badge-warm',
    'Not interested': 'badge-hot',
    'Converted': 'badge-converted',
  }
  return <span className={`badge ${map[status] || 'badge-cold'}`}>{status}</span>
}

export function LeadsTable({ leads, onEdit, onDelete, onRefresh, globalFilter }: LeadsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    id: false,
    updated_at: false,
    date_contacted: false,
    follow_up_date: false,
    qr_usage: false,
    analytics_present: false,
  })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [showColPicker, setShowColPicker] = useState(false)
  const handleMarkContacted = async (lead: Lead) => {
    const supabase = createClient()
    const { error } = await supabase.from('leads').update({
      contacted: true,
      date_contacted: new Date().toISOString(),
    }).eq('id', lead.id)

    if (error) toast.error('Failed to update lead')
    else {
      toast.success(`📡 ${lead.company_name} marked as contacted`)
      onRefresh()
    }
  }

  const handleDeleteSelected = async () => {
    const ids = Object.keys(rowSelection).map(idx => leads[parseInt(idx)].id)
    if (!ids.length) return
    if (!confirm(`Delete ${ids.length} lead(s)?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('leads').delete().in('id', ids)
    if (error) toast.error('Failed to delete leads')
    else {
      toast.success(`🌌 ${ids.length} lead(s) beamed into oblivion`)
      setRowSelection({})
      onRefresh()
    }
  }

  const handleExportCSV = () => {
    const sel = Object.keys(rowSelection)
    const rows = sel.length ? sel.map(i => leads[parseInt(i)]) : leads
    const keys = Object.keys(rows[0] || {}) as (keyof Lead)[]
    const csv = [
      keys.join(','),
      ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(',')),
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `abductr-leads-${Date.now()}.csv`
    a.click()
    toast.success('📊 CSV exported to your ship\'s hard drive')
  }

  const columns = useMemo<ColumnDef<Lead>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <input type="checkbox" className="w-3.5 h-3.5 rounded accent-[#c026d3]"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()} />
      ),
      cell: ({ row }) => (
        <input type="checkbox" className="w-3.5 h-3.5 rounded accent-[#c026d3]"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()} />
      ),
      size: 40,
      enableSorting: false,
    },
    { accessorKey: 'company_name', header: 'Company', cell: i => <span className="font-semibold text-white">{i.getValue<string>()}</span> },
    { accessorKey: 'contact_name', header: 'Contact', cell: i => i.getValue() || <span className="text-[#475569]">—</span> },
    { accessorKey: 'email', header: 'Email', cell: i => i.getValue() ? <a href={`mailto:${i.getValue<string>()}`} className="text-[#22d3ee] hover:underline text-xs">{i.getValue<string>()}</a> : <span className="text-[#475569]">—</span> },
    { accessorKey: 'phone', header: 'Phone', cell: i => i.getValue() || <span className="text-[#475569]">—</span> },
    { accessorKey: 'city', header: 'City' },
    { accessorKey: 'state', header: 'State', size: 60 },
    { accessorKey: 'business_type', header: 'Type' },
    { accessorKey: 'estimated_size', header: 'Size', cell: i => {
      const v = i.getValue<string>(); if (!v) return <span className="text-[#475569]">—</span>
      const c = v === 'Large' ? '#a3e635' : v === 'Medium' ? '#facc15' : '#94a3b8'
      return <span className="badge" style={{ color: c, background: `${c}18`, border: `1px solid ${c}33` }}>{v}</span>
    }},
    { accessorKey: 'budget', header: 'Budget', cell: i => {
      const v = i.getValue<string>(); if (!v) return <span className="text-[#475569]">—</span>
      const c = v === 'High' ? '#a3e635' : v === 'Medium' ? '#facc15' : '#64748b'
      return <span className="badge" style={{ color: c, background: `${c}18`, border: `1px solid ${c}33` }}>{v}</span>
    }},
    { accessorKey: 'need_level', header: 'Need', cell: i => <NeedBadge level={i.getValue<number>()} /> },
    { accessorKey: 'timing', header: 'Timing', cell: i => i.getValue() || <span className="text-[#475569]">—</span> },
    { accessorKey: 'authority', header: 'Authority', cell: i => i.getValue() ? <CheckCircle2 size={14} color="#a3e635" /> : <Circle size={14} color="#475569" /> },
    {
      id: 'bant_score',
      header: 'BANT',
      enableSorting: true,
      accessorFn: (row) => computeBantScore(row),
      cell: ({ row }) => {
        const score = computeBantScore(row.original)
        if (score === 0) return <span className="text-[#475569]">—</span>
        const { label, color } = bantScoreLabel(score)
        return (
          <span
            className="badge font-bold"
            style={{
              color,
              background: `${color}16`,
              border: `1px solid ${color}44`,
              minWidth: 44,
              textAlign: 'center',
            }}
            title={`BANT Score: ${score}/100`}
          >
            {score} <span style={{ opacity: 0.7, fontSize: 9 }}>{label}</span>
          </span>
        )
      },
    },
    { accessorKey: 'contacted', header: 'Contacted', cell: i => i.getValue() ?
      <span className="badge badge-contacted">✓ Yes</span> :
      <span className="badge badge-cold">No</span>
    },
    { accessorKey: 'response_status', header: 'Response', cell: i => <ResponseBadge status={i.getValue<string>()} /> },
    { accessorKey: 'channel', header: 'Channel', cell: i => i.getValue() || <span className="text-[#475569]">—</span> },
    { accessorKey: 'follow_up_date', header: 'Follow-up', cell: i => formatDate(i.getValue<string>()) },
    { accessorKey: 'date_contacted', header: 'Contacted On', cell: i => formatDate(i.getValue<string>()) },
    { accessorKey: 'created_at', header: 'Abducted', cell: i => formatDate(i.getValue<string>()) },
    { accessorKey: 'qr_usage', header: 'QR', cell: i => i.getValue() ? '✓' : '—' },
    { accessorKey: 'analytics_present', header: 'Analytics', cell: i => i.getValue() ? '✓' : '—' },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button onClick={() => onEdit(row.original)} className="btn-ghost px-2 py-1 text-xs" title="Edit">
            <Pencil size={12} />
          </button>
          {!row.original.contacted && (
            <button onClick={() => handleMarkContacted(row.original)} className="btn-ghost px-2 py-1 text-xs" title="Mark Contacted">
              <Phone size={12} />
            </button>
          )}
          <button onClick={() => onDelete(row.original.id)} className="btn-ghost px-2 py-1 text-xs hover:text-red-400" title="Delete">
            <Trash2 size={12} />
          </button>

        </div>
      ),
    },
  ], [onEdit, onDelete, onRefresh])

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  const selectedCount = Object.keys(rowSelection).length

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {selectedCount > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2">
            <span className="text-xs text-[#c026d3]">{selectedCount} selected</span>
            <button onClick={handleDeleteSelected} className="btn-ghost text-xs text-red-400 px-2 py-1">
              <Trash2 size={13} /> Delete
            </button>
          </motion.div>
        )}
        <div className="flex-1" />
        <button onClick={handleExportCSV} className="btn-ghost text-xs px-3">
          <Download size={13} /> Export CSV
        </button>
        <div className="relative">
          <button onClick={() => setShowColPicker(!showColPicker)} className="btn-ghost text-xs px-3">
            🛸 Columns
          </button>
          <AnimatePresence>
            {showColPicker && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-10 z-40 rounded-xl p-3 min-w-[180px] grid grid-cols-2 gap-1"
                style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {table.getAllLeafColumns().filter(c => c.id !== 'select' && c.id !== 'actions').map(col => (
                  <label key={col.id} className="flex items-center gap-1.5 text-xs text-[#94a3b8] cursor-pointer hover:text-white py-0.5">
                    <input type="checkbox" className="w-3 h-3 accent-[#c026d3]"
                      checked={col.getIsVisible()}
                      onChange={col.getToggleVisibilityHandler()} />
                    {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                  </label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl glass-card" style={{ minHeight: 0 }}>
        <table className="leads-table">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        header.column.getIsSorted() === 'asc' ? <ChevronUp size={10} /> :
                        header.column.getIsSorted() === 'desc' ? <ChevronDown size={10} /> :
                        <ChevronsUpDown size={10} className="opacity-30" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-5xl">👽</div>
                    <div className="text-[#64748b] text-sm">No leads in the database, Earthling.</div>
                    <div className="text-[#475569] text-xs">Try running an abduction or add one manually.</div>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.01 }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between flex-shrink-0 text-xs text-[#64748b]">
        <span>
          {table.getFilteredRowModel().rows.length} lead{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''} in database
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="btn-ghost px-2 py-1 disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="btn-ghost px-2 py-1 disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
          <select
            className="alien-select w-auto text-xs"
            value={table.getState().pagination.pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
