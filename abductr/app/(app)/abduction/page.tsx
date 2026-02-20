'use client'
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Search, ChevronRight, Star, Globe, Users, BarChart2, Mail, Rss, Check, RefreshCw, StopCircle } from 'lucide-react'
import { toast } from 'sonner'
import { TopNav } from '@/components/TopNav'
import { UfoIcon, AbductionBeam } from '@/components/UfoIcons'
import { ProxyPanel } from '@/components/ProxyPanel'
import type { ScrapeFieldGroup } from '@/lib/types'
import Link from 'next/link'

const PRESET_TYPES = [
  'Restaurant', 'HVAC', 'Plumbing', 'Retail', 'Dental', 'Legal', 'Salon',
  'Auto Repair', 'Gym', 'Real Estate', 'Accounting', 'Childcare',
]

const US_CITIES = [
  'New York NY', 'Los Angeles CA', 'Chicago IL', 'Houston TX', 'Phoenix AZ',
  'Philadelphia PA', 'San Antonio TX', 'San Diego CA', 'Dallas TX', 'San Jose CA',
  'Austin TX', 'Jacksonville FL', 'Fort Worth TX', 'Columbus OH', 'Charlotte NC',
  'Indianapolis IN', 'San Francisco CA', 'Seattle WA', 'Denver CO', 'Nashville TN',
  'Oklahoma City OK', 'El Paso TX', 'Washington DC', 'Louisville KY', 'Las Vegas NV',
  'Memphis TN', 'Portland OR', 'Baltimore MD', 'Milwaukee WI', 'Albuquerque NM',
  'Tucson AZ', 'Fresno CA', 'Sacramento CA', 'Mesa AZ', 'Kansas City MO',
  'Atlanta GA', 'Omaha NE', 'Colorado Springs CO', 'Raleigh NC', 'Long Beach CA',
  'Virginia Beach VA', 'Minneapolis MN', 'Tampa FL', 'New Orleans LA', 'Arlington TX',
  'Wichita KS', 'Bakersfield CA', 'Aurora CO', 'Anaheim CA', 'Santa Ana CA',
]

const DELAY_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
]

interface FieldGroup {
  id: ScrapeFieldGroup
  label: string
  icon: React.ReactNode
  tags: string[]
  cost: string
  color: string
}

const FIELD_GROUPS: FieldGroup[] = [
  {
    id: 'email',
    label: 'Email Addresses',
    icon: <Mail size={13} />,
    tags: ['Direct email', 'mailto: links', 'Obfuscated decode'],
    cost: '+3s/lead',
    color: '#22d3ee',
  },
  {
    id: 'google_extra',
    label: 'Google Maps Data',
    icon: <Star size={13} />,
    tags: ['Rating â­', 'Reviews', 'Full Address', 'Hours'],
    cost: '+2s/lead',
    color: '#facc15',
  },
  {
    id: 'social',
    label: 'Social Media',
    icon: <Users size={13} />,
    tags: ['Instagram', 'Facebook', 'LinkedIn'],
    cost: '+3s/lead',
    color: '#818cf8',
  },
  {
    id: 'tech_stack',
    label: 'Tech Stack',
    icon: <Globe size={13} />,
    tags: ['CMS', 'Hosting', 'Email Provider (MX)'],
    cost: '+4s/lead',
    color: '#22d3ee',
  },
  {
    id: 'marketing',
    label: 'Marketing Signals',
    icon: <Rss size={13} />,
    tags: ['Contact Form', 'Has Blog', 'Email Signup'],
    cost: '+2s/lead',
    color: '#4ade80',
  },
]

interface ScrapeLog {
  name: string
  status: 'abducted' | 'failed' | 'scanning' | 'duplicate'
  message?: string
}

export default function AbductionPage() {
  const [query, setQuery] = useState('')
  const [maxResults, setMaxResults] = useState(20)
  const [businessType, setBusinessType] = useState('')
  const [selectedFields, setSelectedFields] = useState<ScrapeFieldGroup[]>([])
  const [logs, setLogs] = useState<ScrapeLog[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [abductedCount, setAbductedCount] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')

  // Auto-pilot
  const [autoPilot, setAutoPilot] = useState(false)
  const autoPilotRef = useRef(false)
  const stopRef = useRef(false)
  const [cityIndex, setCityIndex] = useState(0)
  const cityIndexRef = useRef(0)
  const [autoPilotDelay, setAutoPilotDelay] = useState(60)
  const [totalRunCount, setTotalRunCount] = useState(0)
  const [totalLeadsAllRuns, setTotalLeadsAllRuns] = useState(0)

  const toggleAutoPilot = () => {
    setAutoPilot(v => {
      autoPilotRef.current = !v
      return !v
    })
    stopRef.current = false
  }
  const requestStop = () => { stopRef.current = true }

  const toggleField = (id: ScrapeFieldGroup) => {
    setSelectedFields(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  const handleActivate = async (cityOverride?: string) => {
    const baseQuery = cityOverride
      ? `${businessType || query} in ${cityOverride}`
      : query + (businessType ? ` ${businessType}` : '')

    if (!baseQuery.trim()) {
      toast.error('You forgot to aim the tractor beam! Enter a search query.')
      return
    }
    stopRef.current = false
    setRunning(true)
    setDone(false)
    setLogs([])
    setAbductedCount(0)
    setStatusMsg('Warming up tractor beam...')

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: baseQuery,
          maxResults,
          fields: selectedFields,
        }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          try {
            const event = JSON.parse(line.slice(5))
            if (event.type === 'lead') {
              setLogs(prev => [...prev, { name: event.name, status: 'abducted' }])
              setAbductedCount(c => c + 1)
              setStatusMsg(`Abducted: ${event.name}`)
            } else if (event.type === 'duplicate') {
              setLogs(prev => [...prev, { name: event.name, status: 'duplicate' }])
            } else if (event.type === 'blocked') {
              setStatusMsg(`Blocked (attempt ${event.attempt}) — switching proxy...`)
            } else if (event.type === 'error_item') {
              setLogs(prev => [...prev, { name: event.name, status: 'failed' }])
            } else if (event.type === 'status') {
              setStatusMsg(event.message)
            } else if (event.type === 'done') {
              setDone(true)
              setRunning(false)
              setStatusMsg('')
              setTotalRunCount(c => c + 1)
              setTotalLeadsAllRuns(t => t + event.count)
              toast.success(`🛸 ${event.count} leads beamed in!`)
              // ── Auto-pilot: schedule next city ──────────────────────────
              if (autoPilotRef.current && !stopRef.current) {
                const nextIdx = (cityIndexRef.current + 1) % US_CITIES.length
                cityIndexRef.current = nextIdx
                setCityIndex(nextIdx)
                const nextCity = US_CITIES[nextIdx]
                setStatusMsg(`Auto-pilot: next run in ${autoPilotDelay}s → ${nextCity}`)
                setTimeout(() => {
                  if (!stopRef.current && autoPilotRef.current) {
                    handleActivate(nextCity)
                  }
                }, autoPilotDelay * 1000)
              }
            } else if (event.type === 'error') {
              toast.error('Beam malfunction: ' + event.message)
              setRunning(false)
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      toast.error('Tractor beam malfunction: ' + (err instanceof Error ? err.message : String(err)))
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopNav />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <motion.div
              animate={running ? { y: [0, -20, 0], scale: [1, 1.05, 1] } : { y: [0, -10, 0] }}
              transition={{ duration: running ? 1.5 : 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <UfoIcon size={80} animate={false} />
            </motion.div>
          </div>
          <AnimatePresence>
            {running && (
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                className="flex justify-center -mt-4 mb-2"
                style={{ transformOrigin: 'top' }}
              >
                <AbductionBeam width={140} height={160} />
              </motion.div>
            )}
          </AnimatePresence>
          <h1
            className="text-3xl font-black text-white tracking-[0.15em] uppercase mb-2"
            style={{ fontFamily: 'var(--font-display, Orbitron), monospace' }}
          >
            <span style={{ color: '#c026d3' }}>Abduction</span> Bay
          </h1>
          <p className="text-sm text-[#64748b]">
            Point the tractor beam at your target market. We&apos;ll do the rest.
          </p>
          {running && statusMsg && (
            <motion.p
              key={statusMsg}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs mt-2"
              style={{ color: '#22d3ee' }}
            >
              {statusMsg}
            </motion.p>
          )}
        </motion.div>

        <div className="max-w-4xl mx-auto space-y-4">
          {/* Main form row */}
          <div className="grid grid-cols-5 gap-4">
            {/* Left: query + presets + button */}
            <motion.div
              className="col-span-3 glass-card rounded-2xl p-6 space-y-5"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, #c026d3, #22d3ee, transparent)' }} />

              <div>
                <label className="block text-xs text-[#64748b] uppercase tracking-widest mb-2">
                  🎯 Search Query
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                  <input
                    className="alien-input pl-9"
                    placeholder="e.g. pizza restaurants Chicago IL"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    disabled={running}
                    onKeyDown={e => e.key === 'Enter' && !running && handleActivate()}
                  />
                </div>
                <p className="text-[10px] text-[#475569] mt-1">Google Maps search — be specific for best results</p>
              </div>

              <div>
                <label className="block text-xs text-[#64748b] uppercase tracking-widest mb-2">
                  🛸 {autoPilot ? 'Leads per City' : 'Max Results'}: {maxResults}
                  {autoPilot && (
                    <span className="ml-2 normal-case text-[#c026d3] text-[9px] font-normal">
                      (auto-pilot runs indefinitely)
                    </span>
                  )}
                </label>
                <input
                  type="range" min={5} max={50} step={5}
                  value={maxResults}
                  onChange={e => setMaxResults(parseInt(e.target.value))}
                  disabled={running}
                  className="w-full accent-[#c026d3]"
                />
                <div className="flex justify-between text-[10px] text-[#475569]">
                  <span>5</span><span>25</span><span>50</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#64748b] uppercase tracking-widest mb-2">
                  🌍 Target Business Type (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setBusinessType(businessType === type ? '' : type)}
                      disabled={running}
                      className={`text-xs px-3 py-1 rounded-full transition-all ${
                        businessType === type
                          ? 'bg-[#c026d3] text-white border border-[#c026d3]'
                          : 'border border-[rgba(255,255,255,0.1)] text-[#64748b] hover:text-white hover:border-[rgba(192,38,211,0.4)]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleActivate()}
                  disabled={running}
                  className="btn-plasma flex-1 text-sm py-4 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {running ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <UfoIcon size={20} animate={false} />
                      </motion.div>
                      {autoPilot ? `Auto-pilot: Run ${totalRunCount + 1}` : 'Beam in progress...'} ({abductedCount} abducted)
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      {autoPilot ? `⚡ AUTO-PILOT: ${US_CITIES[cityIndex]}` : '⚡ ACTIVATE TRACTOR BEAM'}
                    </>
                  )}
                </button>
                {running && autoPilot && (
                  <button
                    onClick={requestStop}
                    title="Stop after this run finishes"
                    className="px-3 rounded-xl border transition-all text-xs"
                    style={{
                      borderColor: stopRef.current ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.3)',
                      color: stopRef.current ? '#ef4444' : '#94a3b8',
                    }}
                  >
                    <StopCircle size={16} />
                  </button>
                )}
              </div>
            </motion.div>

            {/* Right: live log */}
            <motion.div
              className="col-span-2 glass-card rounded-2xl p-4 flex flex-col"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              style={{ minHeight: 380 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] uppercase tracking-widest"
                  style={{ color: '#22d3ee', fontFamily: 'var(--font-display, Orbitron), monospace' }}>
                  Abduction Log
                </h3>
                {running && <div className="scan-bar w-16 rounded-full" />}
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1" style={{ maxHeight: 280 }}>
                {logs.length === 0 && !running && (
                  <div className="text-center py-10 text-[#475569] text-xs">
                    <div className="text-3xl mb-2">📡</div>
                    Awaiting activation...
                  </div>
                )}
                <AnimatePresence>
                  {logs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-xs py-1 border-b border-[rgba(255,255,255,0.04)]"
                    >
                      <span className="text-sm">
                        {log.status === 'abducted' ? '🛸' : log.status === 'duplicate' ? '📋' : '💀'}
                      </span>
                      <span className={
                        log.status === 'abducted' ? 'text-[#94a3b8]' :
                        log.status === 'duplicate' ? 'text-[#475569] text-[10px]' :
                        'text-red-400/60 line-through'
                      }>
                        {log.name}
                      </span>
                      {log.status === 'abducted' && (
                        <span className="ml-auto text-[#a3e635] text-[10px]">✓</span>
                      )}
                      {log.status === 'duplicate' && (
                        <span className="ml-auto text-[#475569] text-[9px]">dupe</span>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {done && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 rounded-xl p-3 text-center"
                    style={{ background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.2)' }}
                  >
                    <div className="text-2xl mb-1">🎉</div>
                    <div className="text-xs font-semibold text-[#a3e635] mb-2">
                      {abductedCount} leads beamed in!
                    </div>
                    <Link href="/dashboard">
                      <button className="btn-cyan text-xs px-3 py-1">
                        View Dashboard <ChevronRight size={12} />
                      </button>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Field selector */}
          <motion.div
            className="glass-card rounded-2xl p-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={14} style={{ color: '#c026d3' }} />
              <h3 className="text-xs uppercase tracking-widest text-white font-semibold"
                style={{ fontFamily: 'var(--font-display, Orbitron), monospace' }}>
                Enrichment Fields
              </h3>
              <span className="ml-auto text-[10px] text-[#475569]">
                Select which extra data to collect per lead
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {FIELD_GROUPS.map(group => {
                const active = selectedFields.includes(group.id)
                return (
                  <button
                    key={group.id}
                    onClick={() => !running && toggleField(group.id)}
                    disabled={running}
                    className={`relative rounded-xl p-4 text-left transition-all border ${
                      active
                        ? 'border-opacity-60 bg-opacity-10'
                        : 'border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.12)]'
                    }`}
                    style={active ? {
                      borderColor: group.color + '60',
                      background: group.color + '10',
                    } : {}}
                  >
                    {active && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: group.color }}
                      >
                        <Check size={10} className="text-black" />
                      </motion.div>
                    )}
                    <div className="flex items-center gap-1.5 mb-2" style={{ color: group.color }}>
                      {group.icon}
                      <span className="text-[11px] font-semibold">{group.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {group.tags.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full"
                          style={{
                            background: group.color + '18',
                            color: group.color + 'cc',
                          }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-[9px] text-[#475569]">{group.cost}</span>
                  </button>
                )
              })}
            </div>

            {selectedFields.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]"
              >
                <div className="flex items-center gap-2">
                  <Mail size={12} className="text-[#c026d3]" />
                  <span className="text-[10px] text-[#64748b]">
                    <strong className="text-[#94a3b8]">{selectedFields.length} enrichment group{selectedFields.length > 1 ? 's' : ''}</strong> active
                    {' · '}est. +{selectedFields.length * 3}–{selectedFields.length * 6}s per lead
                    {' · '}website required for social/tech/marketing
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ─── Auto-Pilot Panel ───────────────────────────────────────────── */}
          <motion.div
            className="glass-card rounded-2xl p-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw size={14} style={{ color: autoPilot ? '#c026d3' : '#475569' }} />
              <h3 className="text-xs uppercase tracking-widest font-semibold"
                style={{
                  color: autoPilot ? '#c026d3' : '#64748b',
                  fontFamily: 'var(--font-display, Orbitron), monospace',
                }}>
                Auto-Pilot {autoPilot ? '— ACTIVE' : '— OFF'}
              </h3>
              <button
                onClick={toggleAutoPilot}
                disabled={running}
                className="ml-auto px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: autoPilot ? 'rgba(192,38,211,0.2)' : 'rgba(255,255,255,0.05)',
                  border: autoPilot ? '1px solid rgba(192,38,211,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  color: autoPilot ? '#c026d3' : '#64748b',
                }}
              >
                {autoPilot ? 'ENABLED' : 'ENABLE'}
              </button>
            </div>

            {autoPilot && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                {/* Stats bar */}
                {totalRunCount > 0 && (
                  <div className="flex gap-6 text-xs text-[#64748b]">
                    <span>Runs: <strong className="text-[#94a3b8]">{totalRunCount}</strong></span>
                    <span>Total leads: <strong className="text-[#a3e635]">{totalLeadsAllRuns}</strong></span>
                    <span>Current city: <strong className="text-[#22d3ee]">{US_CITIES[cityIndex]}</strong></span>
                  </div>
                )}

                {/* Delay selector */}
                <div>
                  <p className="text-[10px] text-[#475569] uppercase tracking-widest mb-2">Delay between runs</p>
                  <div className="flex gap-2">
                    {DELAY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setAutoPilotDelay(opt.value)}
                        className="px-3 py-1 rounded-full text-xs transition-all"
                        style={{
                          background: autoPilotDelay === opt.value ? 'rgba(192,38,211,0.2)' : 'rgba(255,255,255,0.04)',
                          border: autoPilotDelay === opt.value ? '1px solid rgba(192,38,211,0.5)' : '1px solid rgba(255,255,255,0.08)',
                          color: autoPilotDelay === opt.value ? '#c026d3' : '#64748b',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* City queue preview */}
                <div>
                  <p className="text-[10px] text-[#475569] uppercase tracking-widest mb-2">City rotation queue</p>
                  <div className="flex flex-wrap gap-1.5">
                    {US_CITIES.slice(cityIndex, cityIndex + 8).map((city, i) => (
                      <span
                        key={city}
                        className="text-[9px] px-2 py-0.5 rounded-full"
                        style={{
                          background: i === 0 ? 'rgba(192,38,211,0.2)' : 'rgba(255,255,255,0.04)',
                          border: i === 0 ? '1px solid rgba(192,38,211,0.4)' : '1px solid rgba(255,255,255,0.06)',
                          color: i === 0 ? '#c026d3' : '#475569',
                        }}
                      >
                        {city}
                      </span>
                    ))}
                    <span className="text-[9px] text-[#334155] px-1">
                      +{US_CITIES.length - 8} more cities
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-[#334155]">
                  Auto-pilot rotates through {US_CITIES.length} US cities, appending the city name to your query.
                  Use the stop button (next to the beam button) to halt after the current run finishes.
                </p>
              </motion.div>
            )}
          </motion.div>

        {/* ─── Proxy Shield Panel ─────────────────────────────────────────────── */}
        <div className="w-full max-w-xl mx-auto mt-4">
          <ProxyPanel />
        </div>

        <p className="text-center text-xs text-[#475569] mt-8 max-w-lg mx-auto">
          ⚠️ Scrapes publicly available data. Use responsibly. Comply with Google&apos;s Terms of Service.
        </p>
      </div>
    </div>
  )
}
