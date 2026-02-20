'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { TopNav } from '@/components/TopNav'
import { LeadsTable } from '@/components/LeadsTable'
import { LeadModal } from '@/components/LeadModal'
import { Lead } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

  const fetchLeads = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) toast.error('Failed to fetch leads')
    else setLeads(data as Lead[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this specimen?')) return
    const supabase = createClient()
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) toast.error('Deletion failed')
    else {
      toast.success('🌌 Lead vaporized')
      setLeads(prev => prev.filter(l => l.id !== id))
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopNav
        onNewLead={() => { setEditingLead(null); setModalOpen(true) }}
        onSearch={setGlobalFilter}
      />
      <div className="flex-1 flex flex-col overflow-hidden px-6 py-6 gap-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-white tracking-[0.1em] uppercase"
            style={{ fontFamily: 'var(--font-display, Orbitron), monospace' }}>
            My Leads
          </h1>
          <p className="text-xs text-[#64748b] mt-1">All abducted specimens — {leads.length} total</p>
        </motion.div>

        {loading && <div className="scan-bar rounded-full" />}

        <div className="flex-1 overflow-hidden">
          <LeadsTable
            leads={leads}
            onEdit={(lead) => { setEditingLead(lead); setModalOpen(true) }}
            onDelete={handleDelete}
            onRefresh={fetchLeads}
            globalFilter={globalFilter}
          />
        </div>
      </div>

      <LeadModal
        open={modalOpen}
        lead={editingLead}
        onClose={() => setModalOpen(false)}
        onSaved={(lead) => {
          setLeads(prev => {
            const idx = prev.findIndex(l => l.id === lead.id)
            if (idx >= 0) { const next = [...prev]; next[idx] = lead; return next }
            return [lead, ...prev]
          })
        }}
      />
    </div>
  )
}
