'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TopNav } from '@/components/TopNav'
import { createClient } from '@/lib/supabase/client'
import { Lead } from '@/lib/types'
import { UfoIcon } from '@/components/UfoIcons'

interface Stats {
  byStatus: Record<string, number>
  byChannel: Record<string, number>
  byNeedLevel: Record<number, number>
  bySize: Record<string, number>
  byBudget: Record<string, number>
  byType: Array<{ type: string; count: number }>
  conversionRate: number
  contactedRate: number
  total: number
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs text-[#64748b] truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(value / max) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ background: color }}
        />
      </div>
      <div className="w-6 text-xs text-right" style={{ color }}>{value}</div>
    </div>
  )
}

function StatsCard({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card rounded-xl p-5"
    >
      <h3 className="text-[10px] uppercase tracking-[0.2em] mb-4 font-bold"
        style={{ color: '#c026d3', fontFamily: 'Orbitron, var(--font-display), monospace' }}>
        {title}
      </h3>
      {children}
    </motion.div>
  )
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('leads').select('*').then(({ data }) => {
      if (!data) return
      const leads = data as Lead[]

      const byStatus: Record<string, number> = {}
      const byChannel: Record<string, number> = {}
      const byNeedLevel: Record<number, number> = {}
      const bySize: Record<string, number> = {}
      const byBudget: Record<string, number> = {}
      const byTypeMap: Record<string, number> = {}

      for (const l of leads) {
        if (l.response_status) byStatus[l.response_status] = (byStatus[l.response_status] || 0) + 1
        if (l.channel) byChannel[l.channel] = (byChannel[l.channel] || 0) + 1
        if (l.need_level) byNeedLevel[l.need_level] = (byNeedLevel[l.need_level] || 0) + 1
        if (l.estimated_size) bySize[l.estimated_size] = (bySize[l.estimated_size] || 0) + 1
        if (l.budget) byBudget[l.budget] = (byBudget[l.budget] || 0) + 1
        if (l.business_type) byTypeMap[l.business_type] = (byTypeMap[l.business_type] || 0) + 1
      }

      const byType = Object.entries(byTypeMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([type, count]) => ({ type, count }))

      setStats({
        byStatus,
        byChannel,
        byNeedLevel,
        bySize,
        byBudget,
        byType,
        conversionRate: leads.length > 0 ? (leads.filter(l => l.response_status === 'Converted').length / leads.length) * 100 : 0,
        contactedRate: leads.length > 0 ? (leads.filter(l => l.contacted).length / leads.length) * 100 : 0,
        total: leads.length,
      })
      setLoading(false)
    })
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopNav />
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-2xl font-black text-white tracking-[0.1em] uppercase" style={{ fontFamily: 'Orbitron, var(--font-display), monospace' }}>
            Intel Report
          </h1>
          <p className="text-xs text-[#64748b] mt-1">Deep scan of your lead database</p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
              <UfoIcon size={48} animate={false} />
            </motion.div>
            <div className="scan-bar w-48 rounded-full" />
            <p className="text-xs text-[#64748b]">Scanning database...</p>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-4">
            {/* Conversion funnel */}
            <StatsCard title="🎯 Response Status" delay={0.05}>
              <div className="space-y-2.5">
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <MiniBar key={status} label={status} value={count} max={stats.total}
                    color={status === 'Converted' ? '#a3e635' : status === 'Interested' ? '#facc15' : status === 'Not interested' ? '#ef4444' : '#64748b'} />
                ))}
                {Object.keys(stats.byStatus).length === 0 && (
                  <p className="text-xs text-[#475569]">No outreach data yet</p>
                )}
              </div>
            </StatsCard>

            {/* Channel */}
            <StatsCard title="📡 Outreach Channel" delay={0.1}>
              <div className="space-y-2.5">
                {Object.entries(stats.byChannel).map(([ch, count]) => (
                  <MiniBar key={ch} label={ch} value={count} max={stats.total} color="#22d3ee" />
                ))}
                {Object.keys(stats.byChannel).length === 0 && (
                  <p className="text-xs text-[#475569]">No channel data yet</p>
                )}
              </div>
            </StatsCard>

            {/* Need level */}
            <StatsCard title="🔥 Need Level Distribution" delay={0.15}>
              <div className="space-y-2.5">
                {[5,4,3,2,1].map(level => {
                  const colors = { 5: '#ef4444', 4: '#f97316', 3: '#facc15', 2: '#22d3ee', 1: '#64748b' }
                  return (
                    <MiniBar key={level} label={`Level ${level}`} value={stats.byNeedLevel[level] || 0}
                      max={Math.max(...Object.values(stats.byNeedLevel), 1)}
                      color={colors[level as keyof typeof colors]} />
                  )
                })}
              </div>
            </StatsCard>

            {/* Business types */}
            <StatsCard title="🌍 Top Business Types" delay={0.2}>
              <div className="space-y-2.5">
                {stats.byType.map(({ type, count }) => (
                  <MiniBar key={type} label={type} value={count}
                    max={Math.max(...stats.byType.map(t => t.count), 1)} color="#c026d3" />
                ))}
                {stats.byType.length === 0 && <p className="text-xs text-[#475569]">No data yet</p>}
              </div>
            </StatsCard>

            {/* Budget */}
            <StatsCard title="💰 Budget Signals" delay={0.25}>
              <div className="space-y-2.5">
                {['High', 'Medium', 'Low'].map(b => (
                  <MiniBar key={b} label={b} value={stats.byBudget[b] || 0}
                    max={Math.max(...Object.values(stats.byBudget), 1)}
                    color={b === 'High' ? '#a3e635' : b === 'Medium' ? '#facc15' : '#64748b'} />
                ))}
              </div>
            </StatsCard>

            {/* Key metrics */}
            <StatsCard title="📊 Key Metrics" delay={0.3}>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#64748b]">Contact Rate</span>
                    <span className="text-[#22d3ee]">{stats.contactedRate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div className="h-full rounded-full" initial={{ width: 0 }}
                      animate={{ width: `${stats.contactedRate}%` }} transition={{ duration: 0.8 }}
                      style={{ background: '#22d3ee' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#64748b]">Conversion Rate</span>
                    <span className="text-[#a3e635]">{stats.conversionRate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div className="h-full rounded-full" initial={{ width: 0 }}
                      animate={{ width: `${stats.conversionRate}%` }} transition={{ duration: 0.8, delay: 0.2 }}
                      style={{ background: '#a3e635' }} />
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <div className="flex justify-between">
                    <span className="text-xs text-[#64748b]">Total Leads</span>
                    <span className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, monospace' }}>{stats.total}</span>
                  </div>
                </div>
              </div>
            </StatsCard>
          </div>
        ) : (
          <div className="text-center py-20 text-[#475569]">No data available</div>
        )}
      </div>
    </div>
  )
}
