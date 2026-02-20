'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { TopNav } from '@/components/TopNav'
import { LeadsTable } from '@/components/LeadsTable'
import { LeadModal } from '@/components/LeadModal'
import { UfoIcon } from '@/components/UfoIcons'
import { Lead } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Users, Flame, Send, TrendingUp } from 'lucide-react'

function StatCard({
  label,
  value,
  icon,
  color,
  delay = 0,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  delay?: number
}) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      {/* Corner glow */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color}25 0%, transparent 70%)` }}
      />
      <div className="flex items-start justify-between mb-3">
        <div
          className="p-2 rounded-lg"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          {icon}
        </div>
        <div className="animate-bob">
          <UfoIcon size={22} animate={false} />
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display, Orbitron), monospace' }}>
        {value}
      </div>
      <div className="text-xs text-[#64748b] uppercase tracking-wider">{label}</div>
    </motion.div>
  )
}

export default function DashboardPage() {
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

    if (error) toast.error('Failed to fetch leads: ' + error.message)
    else setLeads(data as Lead[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLeads()

    // Realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel('leads_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads()
        toast.info('📡 Signal from the mothership — database updated', { duration: 2500 })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchLeads])

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Beam this lead into the void? This cannot be undone.')) return
    const supabase = createClient()
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) toast.error('Deletion failed')
    else {
      toast.success('🌌 Lead vaporized')
      setLeads(prev => prev.filter(l => l.id !== id))
    }
  }

  const stats = {
    total: leads.length,
    hot: leads.filter(l => (l.need_level ?? 0) >= 4).length,
    contactedToday: leads.filter(l => {
      if (!l.date_contacted) return false
      const d = new Date(l.date_contacted)
      const now = new Date()
      return d.toDateString() === now.toDateString()
    }).length,
    conversionPct: leads.length > 0
      ? Math.round((leads.filter(l => l.response_status === 'Converted').length / leads.length) * 100)
      : 0,
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopNav
        onNewLead={() => { setEditingLead(null); setModalOpen(true) }}
        onSearch={setGlobalFilter}
      />

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1
              className="text-2xl font-bold text-white tracking-[0.1em] uppercase"
              style={{ fontFamily: 'var(--font-display, Orbitron), monospace' }}
            >
              Mission Control
            </h1>
            <p className="text-xs text-[#64748b] mt-1">
              All abducted specimens in one place
            </p>
          </div>
          <div className="text-xs text-[#475569] font-mono">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </motion.div>

        {/* Scan loading bar */}
        {loading && <div className="scan-bar rounded-full" />}

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Leads" value={stats.total} icon={<Users size={16} color="#c026d3" />} color="#c026d3" delay={0.05} />
          <StatCard label="Hot Leads" value={stats.hot} icon={<Flame size={16} color="#ef4444" />} color="#ef4444" delay={0.1} />
          <StatCard label="Contacted Today" value={stats.contactedToday} icon={<Send size={16} color="#22d3ee" />} color="#22d3ee" delay={0.15} />
          <StatCard label="Conversion %" value={`${stats.conversionPct}%`} icon={<TrendingUp size={16} color="#a3e635" />} color="#a3e635" delay={0.2} />
        </div>

        {/* Table */}
        <motion.div
          className="flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ minHeight: '400px' }}
        >
          <LeadsTable
            leads={leads}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRefresh={fetchLeads}
            globalFilter={globalFilter}
          />
        </motion.div>
      </div>

      <LeadModal
        open={modalOpen}
        lead={editingLead}
        onClose={() => setModalOpen(false)}
        onSaved={(lead) => {
          setLeads(prev => {
            const idx = prev.findIndex(l => l.id === lead.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = lead
              return next
            }
            return [lead, ...prev]
          })
        }}
      />
    </div>
  )
}
