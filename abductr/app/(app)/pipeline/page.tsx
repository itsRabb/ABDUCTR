'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Map, Globe, Mail, Database, Play, Square, RefreshCw,
  ChevronRight, Zap, CheckCircle, AlertCircle, ArrowRight,
  Repeat, Timer, Cpu, Activity, RotateCcw, Plus, X, Building2,
} from 'lucide-react'

// ─── 100 US city targets for auto-pilot ──────────────────────────────────────

interface FoundLead {
  company_name: string
  phone?: string
  city?: string
  state?: string
  address_full?: string
  website?: string
  business_type?: string
  emails: string[]
  // Worker 3 site signals
  contact_name?: string
  role?: string
  instagram?: string
  facebook?: string
  linkedin_url?: string
  cms?: string
  analytics_present?: boolean
  has_contact_form?: boolean
  has_blog?: boolean
  has_email_signup?: boolean
}
const US_CITIES = [
  'New York NY','Los Angeles CA','Chicago IL','Houston TX','Phoenix AZ',
  'Philadelphia PA','San Antonio TX','San Diego CA','Dallas TX','San Jose CA',
  'Austin TX','Jacksonville FL','Fort Worth TX','Columbus OH','Charlotte NC',
  'Indianapolis IN','San Francisco CA','Seattle WA','Denver CO','Nashville TN',
  'Oklahoma City OK','El Paso TX','Washington DC','Las Vegas NV','Louisville KY',
  'Memphis TN','Portland OR','Baltimore MD','Milwaukee WI','Albuquerque NM',
  'Tucson AZ','Fresno CA','Sacramento CA','Mesa AZ','Kansas City MO',
  'Atlanta GA','Omaha NE','Colorado Springs CO','Raleigh NC','Long Beach CA',
  'Virginia Beach VA','Minneapolis MN','Tampa FL','New Orleans LA','Arlington TX',
  'Bakersfield CA','Honolulu HI','Anaheim CA','Aurora CO','Santa Ana CA',
  'Corpus Christi TX','Riverside CA','Lexington KY','St Louis MO','Pittsburgh PA',
  'Stockton CA','Anchorage AK','Cincinnati OH','St Paul MN','Greensboro NC',
  'Toledo OH','Newark NJ','Plano TX','Henderson NV','Orlando FL',
  'Lincoln NE','Jersey City NJ','Chandler AZ','Fort Wayne IN','Madison WI',
  'Lubbock TX','Scottsdale AZ','Reno NV','Buffalo NY','Durham NC',
  'Glendale AZ','Winston-Salem NC','Hialeah FL','Chesapeake VA','Garland TX',
  'Laredo TX','Gilbert AZ','Baton Rouge LA','Birmingham AL','Rochester NY',
  'Richmond VA','Spokane WA','Des Moines IA','Montgomery AL','Modesto CA',
  'Fayetteville NC','Tacoma WA','Fremont CA','Shreveport LA','Huntsville AL',
  'San Bernardino CA','Glendale CA','Columbus GA','Grand Rapids MI','Salt Lake City UT',
  'Tallahassee FL','Huntington Beach CA','Worcester MA','Knoxville TN','Providence RI',
]

// ─── Types ────────────────────────────────────────────────────────────────────
interface PipelineEvent {
  id: number
  type: string
  ts: string
  message: string
  color: string
}

interface WorkerStats {
  status: 'idle' | 'running' | 'done' | 'error'
  count: number
  current?: string
}

interface EnrichJob {
  company: string
  emails: Array<{ email: string; source: string; confidence: string }>
}

// ─── Worker card ──────────────────────────────────────────────────────────────
function WorkerCard({
  num, icon, avatar, title, desc, stats, accent,
}: {
  num: number
  icon: React.ReactNode
  avatar?: React.ReactNode
  title: string
  desc: string
  stats: WorkerStats
  accent: string
}) {
  const isRunning = stats.status === 'running'
  const isDone = stats.status === 'done'
  const isError = stats.status === 'error'

  return (
    <div
      className="relative flex-1 rounded-xl p-4 flex flex-col gap-3 min-w-0"
      style={{
        background: 'rgba(10,10,18,0.9)',
        border: `1px solid ${isRunning ? accent : isDone ? '#22c55e40' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isRunning ? `0 0 20px ${accent}22` : 'none',
        transition: 'border 0.3s, box-shadow 0.3s',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: `${accent}18`,
            border: `1px solid ${accent}40`,
            color: accent,
          }}
        >
          {avatar
            ? <span style={{ fontSize: 22, lineHeight: 1 }}>{avatar}</span>
            : icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#475569]">WORKER {num}</span>
            {isRunning && (
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ background: `${accent}20`, color: accent }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
                LIVE
              </span>
            )}
            {isDone && <CheckCircle size={12} className="text-green-400" />}
            {isError && <AlertCircle size={12} className="text-red-400" />}
          </div>
          <p className="text-sm font-semibold text-white truncate">{title}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-[#475569] leading-relaxed">{desc}</p>

      {/* Counter */}
      <div
        className="rounded-lg px-3 py-2 flex items-center justify-between"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span className="text-xs text-[#475569]">Processed</span>
        <span
          className="text-2xl font-mono font-bold tabular-nums"
          style={{ color: stats.count > 0 ? accent : '#334155' }}
        >
          {stats.count}
        </span>
      </div>

      {/* Current item */}
      {stats.current && (
        <p className="text-xs font-mono truncate" style={{ color: accent }}>
          ▶ {stats.current}
        </p>
      )}
    </div>
  )
}

// ─── Flow arrow ───────────────────────────────────────────────────────────────
function FlowArrow({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 flex-shrink-0 self-center" style={{ width: 40 }}>
      <ArrowRight
        size={20}
        style={{
          color: active ? '#22d3ee' : '#1e293b',
          filter: active ? 'drop-shadow(0 0 6px #22d3ee)' : 'none',
          transition: 'color 0.4s, filter 0.4s',
        }}
      />
      {active && (
        <div
          className="mt-1 w-0.5 h-4 rounded"
          style={{
            background: 'linear-gradient(to bottom, #22d3ee, transparent)',
            animation: 'pulse 1.2s ease-in-out infinite',
          }}
        />
      )}
    </div>
  )
}

// ─── DB node ──────────────────────────────────────────────────────────────────
function DbNode({ saved, active: _active }: { saved: number; active: boolean }) {
  return (
    <div
      className="flex-shrink-0 rounded-xl p-4 flex flex-col items-center gap-2 justify-center"
      style={{
        background: 'rgba(10,10,18,0.9)',
        border: `1px solid ${saved > 0 ? '#a855f740' : 'rgba(255,255,255,0.07)'}`,
        width: 120,
        boxShadow: saved > 0 ? '0 0 20px #a855f718' : 'none',
        transition: 'border 0.3s, box-shadow 0.3s',
      }}
    >
      <Database size={20} style={{ color: saved > 0 ? '#a855f7' : '#334155' }} />
      <span className="text-xs text-[#475569] font-mono">SUPABASE</span>
      <span
        className="text-xl font-mono font-bold"
        style={{ color: saved > 0 ? '#a855f7' : '#334155' }}
      >
        {saved}
      </span>
      <span className="text-xs text-[#475569]">saved</span>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  // Form state
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('')
  const [maxLeads, setMaxLeads] = useState(15)
  const [autoSave, setAutoSave] = useState(false)
  const [deepCrawl, setDeepCrawl] = useState(true)

  // Auto-pilot state
  const [autoPilot, setAutoPilot] = useState(false)
  const [apDelaySec, setApDelaySec] = useState(90)        // seconds between cities
  const [apCityIdx, setApCityIdx] = useState(0)           // current index into US_CITIES
  const [apRunCount, setApRunCount] = useState(0)         // completed runs
  const [apCurrentCity, setApCurrentCity] = useState('')  // display label
  const [apCountdown, setApCountdown] = useState(0)       // seconds left in delay
  const apStopRef = useRef(false)
  const apAbortRef = useRef<AbortController | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Pipeline state
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const eventId = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  // Worker stats
  const [w1, setW1] = useState<WorkerStats>({ status: 'idle', count: 0 })
  const [w2, setW2] = useState<WorkerStats>({ status: 'idle', count: 0 })
  const [w3, setW3] = useState<WorkerStats>({ status: 'idle', count: 0 })
  const [saved, setSaved] = useState(0)

  // Totals across all auto-pilot runs
  const [apTotalLeads, setApTotalLeads] = useState(0)
  const [apTotalEmails, setApTotalEmails] = useState(0)

  // Found leads (live table)
  const [foundLeads, setFoundLeads] = useState<FoundLead[]>([])

  // ── Background Server Cron state ────────────────────────────────────────
  interface CronStatus {
    mode: 'local' | 'production'
    active: boolean
    running: boolean
    runsCompleted: number
    totalLeads: number
    totalEmails: number
    lastRunAt: string | null
    lastError: string | null
    intervalMin: number | null
    queries: string[]
    currentQuery: string | null
    queryIndex: number
    cityIndex: number
  }
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null)
  const [cronQueryInput, setCronQueryInput] = useState('')
  const [cronQueries, setCronQueries] = useState<string[]>([])
  const [cronInterval, setCronInterval] = useState(35)
  const [cronMaxLeads, setCronMaxLeads] = useState(20)
  const [cronRunsPerQuery, setCronRunsPerQuery] = useState(1)
  const [cronLoading, setCronLoading] = useState(false)
  const cronPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-pilot query rotation
  const [apRotateQueries, setApRotateQueries] = useState(false)
  const [apQueryInput, setApQueryInput] = useState('')
  const [apQueryList, setApQueryList] = useState<string[]>([])
  const [apRunsPerQuery, setApRunsPerQuery] = useState(1)  // cities to run before switching query

  const fetchCronStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/cron-control')
      if (r.ok) setCronStatus(await r.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchCronStatus()
    cronPollRef.current = setInterval(fetchCronStatus, 5000)
    return () => {
      if (cronPollRef.current) clearInterval(cronPollRef.current)
    }
  }, [fetchCronStatus])

  const cronAction = useCallback(async (action: 'start' | 'stop' | 'run-now') => {
    setCronLoading(true)
    try {
      const queries = cronQueries.length > 0 ? cronQueries : (cronQueryInput || query || 'plumber').split(',').map(s => s.trim()).filter(Boolean)
      await fetch('/api/cron-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          queries,
          intervalMin: cronInterval,
          maxLeads: cronMaxLeads,
          runsPerQuery: cronRunsPerQuery,
        }),
      })
      await fetchCronStatus()
    } finally {
      setCronLoading(false)
    }
  }, [cronQueries, cronQueryInput, cronInterval, cronMaxLeads, cronRunsPerQuery, query, fetchCronStatus])

  // Batch enrich state
  const [enrichRunning, setEnrichRunning] = useState(false)
  const [enrichDone, setEnrichDone] = useState(false)
  const [enrichJobs, setEnrichJobs] = useState<EnrichJob[]>([])
  const [enrichStats, setEnrichStats] = useState({ processed: 0, total: 0, emails: 0 })
  const enrichAbortRef = useRef<AbortController | null>(null)

  const logEvent = useCallback((msg: string, color: string, type = 'info') => {
    const ev: PipelineEvent = {
      id: ++eventId.current,
      type,
      ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
      message: msg,
      color,
    }
    setEvents(prev => [ev, ...prev].slice(0, 200))
  }, [])

  const resetWorkers = () => {
    setW1({ status: 'idle', count: 0 })
    setW2({ status: 'idle', count: 0 })
    setW3({ status: 'idle', count: 0 })
    setSaved(0)
    setDone(false)
  }

  const resetPipeline = () => {
    resetWorkers()
    setEvents([])
    setFoundLeads([])
    setApRunCount(0)
    setApTotalLeads(0)
    setApTotalEmails(0)
    setApCurrentCity('')
    setApCountdown(0)
  }

  // Core: run one city through the full pipeline, returns { leads, emails }
  const runOnce = useCallback(async (
    q: string, c: string, signal: AbortSignal
  ): Promise<{ leads: number; emails: number }> => {
    resetWorkers()
    setRunning(true)
    let totalLeads = 0, totalEmails = 0

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim(), city: c.trim(), maxLeads, autoSave, deepCrawl }),
        signal,
      })
      if (!res.ok || !res.body) throw new Error('Pipeline API error')

      setW1(prev => ({ ...prev, status: 'running' }))
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done: streamDone } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))

            if (ev.type === 'worker1') {
              setW1(prev => ({ status: 'running', count: prev.count + 1, current: ev.data?.company_name }))
              const loc = [ev.data?.city, ev.data?.state].filter(Boolean).join(', ')
              const meta = [
                ev.data?.business_type,
                ev.data?.rating ? `★${ev.data.rating}` : null,
                ev.data?.review_count ? `${ev.data.review_count} reviews` : null,
                ev.data?.phone || null,
              ].filter(Boolean).join(' · ')
              logEvent(`[W1] ${ev.data?.company_name}${loc ? ` — ${loc}` : ''}${meta ? `  [${meta}]` : ''}${ev.data?.website ? ` ↗ ${ev.data.website.replace(/^https?:\/\//, '')}` : ' (no website)'}`, '#38bdf8')
              setFoundLeads(prev => [{
                company_name: ev.data?.company_name || '',
                phone: ev.data?.phone,
                city: ev.data?.city,
                state: ev.data?.state,
                address_full: ev.data?.address_full,
                website: ev.data?.website,
                business_type: ev.data?.business_type,
                emails: [],
              }, ...prev].slice(0, 500))
            }
            if (ev.type === 'worker2') {
              setW2(prev => ({
                status: 'running',
                count: ev.data?.status === 'fetched' ? prev.count + 1 : prev.count,
                current: ev.data?.url?.replace(/^https?:\/\//, '').slice(0, 40),
              }))
              if (ev.data?.status === 'fetching')
                logEvent(`[W2] Fetching ${ev.data.url?.replace(/^https?:\/\//, '')}`, '#94a3b8')
            }
            if (ev.type === 'worker3') {
              setW3(prev => ({ status: 'running', count: prev.count + 1, current: ev.data?.email }))
              logEvent(`[W3] ✉  ${ev.data?.email}  (${ev.data?.source || 'regex'})`, '#22d3ee')
              if (ev.data?.company) {
                setFoundLeads(prev => prev.map(l =>
                  l.company_name === ev.data.company
                    ? { ...l, emails: [...new Set([...l.emails, ev.data.email])] }
                    : l
                ))
              }
            }
            if (ev.type === 'saved') {
              setSaved(prev => prev + 1)
              logEvent(`[DB] Saved "${ev.data?.lead_name}" — ${ev.data?.email_count} email(s)`, '#a855f7')
            }
            if (ev.type === 'found') {
              const comp = ev.data?.lead?.company_name || ''
              const sig = ev.data?.signals || {}
              setFoundLeads(prev => prev.map(l => {
                if (l.company_name !== comp) return l
                const merged = { ...l, ...sig }
                for (const email of (ev.data?.emails || []))
                  merged.emails = [...new Set([...merged.emails, email])]
                return merged
              }))
            }
            if (ev.type === 'status')
              logEvent(ev.message, ev.stage === 1 ? '#38bdf8' : ev.stage === 2 ? '#94a3b8' : '#22d3ee')
            if (ev.type === 'warning') logEvent(`⚠  ${ev.message}`, '#fbbf24', 'warning')
            if (ev.type === 'error')   logEvent(`✕  ${ev.message}`, '#f87171', 'error')
            if (ev.type === 'done') {
              totalLeads  = ev.data?.total_leads  || 0
              totalEmails = ev.data?.total_emails || 0
              setW1(prev => ({ ...prev, status: 'done', current: undefined }))
              setW2(prev => ({ ...prev, status: prev.count > 0 ? 'done' : 'idle', current: undefined }))
              setW3(prev => ({ ...prev, status: prev.count > 0 ? 'done' : 'idle', current: undefined }))
              logEvent(`── Done: ${totalLeads} leads · ${totalEmails} emails (${c}) ──`, '#22c55e', 'done')
              setDone(true)
            }
          } catch { /* malformed line */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        logEvent(`Pipeline error: ${err.message}`, '#f87171', 'error')
      throw err
    } finally {
      setRunning(false)
    }
    return { leads: totalLeads, emails: totalEmails }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, maxLeads, autoSave, deepCrawl, logEvent])

  // Start: single run or auto-pilot loop
  const startPipeline = async () => {
    if (!query.trim()) return
    if (!autoPilot && !city.trim()) return

    resetPipeline()
    apStopRef.current = false
    const abort = new AbortController()
    apAbortRef.current = abort
    abortRef.current = abort

    if (!autoPilot) {
      // Single run
      await runOnce(query, city, abort.signal).catch(() => null)
      return
    }

    // Auto-pilot loop — cycles through US_CITIES indefinitely
    let idx = apCityIdx
    let runNum = 0
    logEvent('🛸 Auto-pilot engaged — running 24/7 across US cities', '#22d3ee')

    while (!apStopRef.current) {
      const targetCity = US_CITIES[idx % US_CITIES.length]
      // Rotate query if user has a list, otherwise use the form query
      const targetQuery = (apRotateQueries && apQueryList.length > 0)
        ? apQueryList[Math.floor(runNum / apRunsPerQuery) % apQueryList.length]
        : query
      setApCurrentCity(targetCity)
      setApCityIdx(idx % US_CITIES.length)
      logEvent(`── Run #${runNum + 1}: "${targetQuery}" in ${targetCity} ──`, '#38bdf8')

      try {
        const { leads, emails } = await runOnce(targetQuery, targetCity, abort.signal)
        runNum++
        setApRunCount(runNum)
        setApTotalLeads(prev => prev + leads)
        setApTotalEmails(prev => prev + emails)
        idx++
      } catch {
        if (apStopRef.current) break
        logEvent('Run failed — waiting before retry...', '#fbbf24')
      }

      if (apStopRef.current) break

      // Countdown delay
      let remaining = apDelaySec
      setApCountdown(remaining)
      logEvent(`⏱  Next city in ${apDelaySec}s...`, '#475569')

      await new Promise<void>((resolve) => {
        countdownRef.current = setInterval(() => {
          remaining--
          setApCountdown(remaining)
          if (remaining <= 0 || apStopRef.current) {
            clearInterval(countdownRef.current!)
            resolve()
          }
        }, 1000)
      })

      if (apStopRef.current) break
    }

    setApCurrentCity('')
    setApCountdown(0)
    if (!apStopRef.current)
      logEvent('── Auto-pilot complete (all cities done) ──', '#22c55e')
  }

  const stopPipeline = () => {
    apStopRef.current = true
    apAbortRef.current?.abort()
    abortRef.current?.abort()
    if (countdownRef.current) clearInterval(countdownRef.current)
    setRunning(false)
    setApCountdown(0)
    setApCurrentCity('')
    logEvent('── Pipeline stopped by user ──', '#fbbf24', 'warning')
  }

  const startEnrich = async () => {
    setEnrichRunning(true)
    setEnrichDone(false)
    setEnrichJobs([])
    setEnrichStats({ processed: 0, total: 0, emails: 0 })

    const abort = new AbortController()
    enrichAbortRef.current = abort

    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deepCrawl, limit: 50 }),
        signal: abort.signal,
      })
      if (!res.ok || !res.body) throw new Error('Enrich API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.type === 'status') setEnrichStats(prev => ({ ...prev, total: parseInt(ev.message.match(/\d+/)?.[0] || '0') || prev.total }))
            if (ev.type === 'progress') setEnrichStats(prev => ({ ...prev, processed: ev.data.current }))
            if (ev.type === 'enriched') {
              setEnrichJobs(prev => [{ company: ev.data.company, emails: ev.data.emails }, ...prev].slice(0, 50))
              setEnrichStats(prev => ({ ...prev, emails: prev.emails + ev.data.emails.length }))
            }
            if (ev.type === 'done') {
              setEnrichStats(ev.data)
              setEnrichDone(true)
              setEnrichRunning(false)
            }
            if (ev.type === 'error') {
              setEnrichDone(true)
              setEnrichRunning(false)
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setEnrichDone(true)
      }
    } finally {
      setEnrichRunning(false)
    }
  }

  const stopEnrich = () => {
    enrichAbortRef.current?.abort()
    setEnrichRunning(false)
  }

  const anyActive = w1.status === 'running' || w2.status === 'running' || w3.status === 'running'
  void anyActive

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'rgba(4,4,10,0.98)' }}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-6 py-4 flex items-center gap-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)' }}
          >
            <Zap size={18} style={{ color: '#22d3ee' }} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white leading-tight">Lead Intel Pipeline</h1>
            <p className="text-xs text-[#475569]">Maps Scout → Site Crawler → Data Extractor → Database · AI Agent enriches BANT fields</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Controls */}
        {!running ? (
          <button
            onClick={startPipeline}
            disabled={!query.trim() || (!autoPilot && !city.trim())}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: autoPilot ? 'rgba(34,211,238,0.15)' : 'rgba(34,211,238,0.15)',
              border: '1px solid rgba(34,211,238,0.3)',
              color: '#22d3ee',
            }}
          >
            {autoPilot ? <Repeat size={14} /> : <Play size={14} />}
            {autoPilot ? 'Start 24/7' : 'Run Pipeline'}
          </button>
        ) : (
          <>
            {autoPilot && apCurrentCity && (
              <div className="flex items-center gap-2 text-xs font-mono" style={{ color: '#22d3ee' }}>
                <Repeat size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
                Run #{apRunCount + 1} • {apCurrentCity}
                {apCountdown > 0 && <span className="text-[#475569]">(next in {apCountdown}s)</span>}
              </div>
            )}
            <button
              onClick={stopPipeline}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: 'rgba(248,113,113,0.12)',
                border: '1px solid rgba(248,113,113,0.3)',
                color: '#f87171',
              }}
            >
              <Square size={14} />
              Stop
            </button>
          </>
        )}

        {!running && (done || apRunCount > 0) && (
          <button
            onClick={resetPipeline}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/5 text-[#64748b]"
          >
            <RefreshCw size={13} />
            Reset
          </button>
        )}
      </div>

      {/* Main content — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

        {/* Search form */}
        <div
          className="rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
          style={{ background: 'rgba(10,10,18,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#64748b] font-mono">BUSINESS TYPE / QUERY</label>
            <input
              className="alien-input text-sm h-9"
              placeholder="e.g. real estate agent"
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={running}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#64748b] font-mono">
              {autoPilot ? 'CITY (overridden by auto-pilot)' : 'CITY'}
            </label>
            <input
              className="alien-input text-sm h-9"
              placeholder={autoPilot ? 'Auto-pilot rotates US cities' : 'e.g. Chicago IL'}
              value={autoPilot ? apCurrentCity || '' : city}
              onChange={e => !autoPilot && setCity(e.target.value)}
              disabled={running || autoPilot}
              style={{ opacity: autoPilot ? 0.45 : 1 }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#64748b] font-mono">MAX LEADS PER CITY: {maxLeads}</label>
            <input
              type="range" min={5} max={50} step={5}
              value={maxLeads}
              onChange={e => setMaxLeads(Number(e.target.value))}
              disabled={running}
              className="mt-2"
            />
          </div>
          <div className="flex flex-col gap-2 justify-center">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => !running && setDeepCrawl(v => !v)}
                className="w-8 h-4 rounded-full transition-all cursor-pointer relative"
                style={{ background: deepCrawl ? 'rgba(34,211,238,0.5)' : 'rgba(100,116,139,0.3)' }}
              >
                <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                  style={{ left: deepCrawl ? 'calc(100% - 14px)' : '2px' }} />
              </div>
              <span className="text-xs text-[#94a3b8]">Deep crawl contact pages</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => !running && setAutoSave(v => !v)}
                className="w-8 h-4 rounded-full transition-all cursor-pointer relative"
                style={{ background: autoSave ? 'rgba(168,85,247,0.5)' : 'rgba(100,116,139,0.3)' }}
              >
                <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                  style={{ left: autoSave ? 'calc(100% - 14px)' : '2px' }} />
              </div>
              <span className="text-xs text-[#94a3b8]">Auto-save to Supabase</span>
            </label>
          </div>
        </div>

        {/* Auto-pilot panel */}
        <div
          className="rounded-xl p-4"
          style={{
            background: autoPilot ? 'rgba(34,211,238,0.04)' : 'rgba(10,10,18,0.5)',
            border: `1px solid ${autoPilot ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.06)'}`,
            transition: 'background 0.3s, border 0.3s',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: autoPilot ? 'rgba(34,211,238,0.15)' : 'rgba(100,116,139,0.1)',
                border: `1px solid ${autoPilot ? 'rgba(34,211,238,0.3)' : 'rgba(100,116,139,0.2)'}`,
              }}
            >
              <Repeat size={14} style={{ color: autoPilot ? '#22d3ee' : '#475569' }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold" style={{ color: autoPilot ? '#22d3ee' : '#94a3b8' }}>
                  24/7 Auto-Pilot
                </span>
                <div
                  onClick={() => !running && setAutoPilot(v => !v)}
                  className="w-9 h-5 rounded-full transition-all cursor-pointer relative"
                  style={{ background: autoPilot ? 'rgba(34,211,238,0.5)' : 'rgba(100,116,139,0.3)' }}
                >
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: autoPilot ? 'calc(100% - 18px)' : '2px' }} />
                </div>
              </div>
              <p className="text-xs text-[#475569] mt-0.5">
                {autoPilot
                  ? `Cycles through ${US_CITIES.length} US cities non-stop — runs all night & weekend`
                  : 'Enable to loop through 100 US cities automatically while you sleep'}
              </p>
            </div>

            {autoPilot && (
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#64748b] font-mono">DELAY BETWEEN CITIES</label>
                  <select
                    className="alien-select-sm"
                    value={apDelaySec}
                    onChange={e => setApDelaySec(Number(e.target.value))}
                    disabled={running}
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={90}>90 seconds</option>
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Query rotation for auto-pilot */}
          {autoPilot && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Repeat size={11} style={{ color: apRotateQueries ? '#22d3ee' : '#475569' }} />
                <span className="text-xs font-semibold" style={{ color: apRotateQueries ? '#22d3ee' : '#64748b' }}>Query Rotation</span>
                <div
                  onClick={() => !running && setApRotateQueries(v => !v)}
                  className="w-7 h-4 rounded-full transition-all cursor-pointer relative"
                  style={{ background: apRotateQueries ? 'rgba(34,211,238,0.5)' : 'rgba(100,116,139,0.3)' }}
                >
                  <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                    style={{ left: apRotateQueries ? 'calc(100% - 14px)' : '2px' }} />
                </div>
                <span className="text-[10px] text-[#475569]">
                  {apRotateQueries ? `Switching query every ${apRunsPerQuery} city run${apRunsPerQuery > 1 ? 's' : ''}` : 'Enable to cycle multiple query types'}
                </span>
              </div>
              {apRotateQueries && (
                <>
                  {/* Runs per query selector */}
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-[10px] text-[#64748b] font-mono flex-shrink-0">CITIES PER QUERY</label>
                    <select
                      className="alien-select-sm"
                      value={apRunsPerQuery}
                      onChange={e => setApRunsPerQuery(Number(e.target.value))}
                      disabled={running}
                    >
                      <option value={1}>1 city then rotate</option>
                      <option value={2}>2 cities then rotate</option>
                      <option value={3}>3 cities then rotate</option>
                      <option value={5}>5 cities then rotate</option>
                      <option value={10}>10 cities then rotate</option>
                    </select>
                    <span className="text-[10px] text-[#475569]">
                      {apQueryList.length > 0
                        ? `≈ every ${apRunsPerQuery * Math.round(apDelaySec / 60)} min per query`
                        : ''}
                    </span>
                  </div>
                  {/* Query pills */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {apQueryList.map((q, i) => (
                      <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee' }}>
                        {q}
                        <button onClick={() => !running && setApQueryList(prev => prev.filter((_, j) => j !== i))}>
                          <X size={10} style={{ color: '#94a3b8' }} />
                        </button>
                      </span>
                    ))}
                    {apQueryList.length === 0 && (
                      <span className="text-[10px] text-[#475569] italic">No queries added — will use the query field above</span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      className="alien-input text-xs h-7 flex-1"
                      placeholder="e.g. pizza restaurant"
                      value={apQueryInput}
                      onChange={e => setApQueryInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && apQueryInput.trim()) {
                          setApQueryList(prev => [...prev, apQueryInput.trim()])
                          setApQueryInput('')
                        }
                      }}
                      disabled={running}
                    />
                    <button
                      className="h-7 px-2.5 rounded-lg text-xs flex items-center gap-1"
                      style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee' }}
                      onClick={() => { if (apQueryInput.trim()) { setApQueryList(prev => [...prev, apQueryInput.trim()]); setApQueryInput('') } }}
                      disabled={running}
                    >
                      <Plus size={11} /> Add
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Auto-pilot live stats */}
          {autoPilot && (running || apRunCount > 0) && (
            <div className="grid grid-cols-4 gap-3 mt-2">
              {[
                { label: 'Cities Done', val: apRunCount, ic: <CheckCircle size={11} />, color: '#22c55e' },
                { label: 'Total Leads', val: apTotalLeads, ic: <Map size={11} />, color: '#38bdf8' },
                { label: 'Emails Found', val: apTotalEmails, ic: <Mail size={11} />, color: '#22d3ee' },
                { label: apCountdown > 0 ? 'Next in' : 'Status', val: apCountdown > 0 ? `${apCountdown}s` : (running ? 'Running' : 'Done'), ic: <Timer size={11} />, color: apCountdown > 0 ? '#fbbf24' : running ? '#22d3ee' : '#22c55e' },
              ].map(s => (
                <div key={s.label} className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-1 text-[10px] text-[#475569] mb-0.5 truncate">
                    <span style={{ color: s.color }}>{s.ic}</span> {s.label}
                  </div>
                  <div className="text-sm font-mono font-bold leading-tight" style={{ color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Background Server Cron panel ───────────────────────────────── */}
        <div
          className="rounded-xl p-4"
          style={{
            background: cronStatus?.active ? 'rgba(168,85,247,0.04)' : 'rgba(10,10,18,0.5)',
            border: `1px solid ${cronStatus?.active ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.06)'}`,
            transition: 'background 0.3s, border 0.3s',
          }}
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{
                background: cronStatus?.active ? 'rgba(168,85,247,0.15)' : 'rgba(100,116,139,0.1)',
                border: `1px solid ${cronStatus?.active ? 'rgba(168,85,247,0.3)' : 'rgba(100,116,139,0.2)'}`,
              }}
            >
              <Cpu size={14} style={{ color: cronStatus?.active ? '#a855f7' : '#475569' }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: cronStatus?.active ? '#a855f7' : '#94a3b8' }}>
                  Background Server Cron
                </span>
                {cronStatus && (
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold tracking-wider"
                    style={{
                      background: cronStatus.mode === 'local' ? 'rgba(34,211,238,0.1)' : 'rgba(34,197,94,0.1)',
                      color:      cronStatus.mode === 'local' ? '#22d3ee' : '#22c55e',
                      border:     `1px solid ${cronStatus.mode === 'local' ? 'rgba(34,211,238,0.2)' : 'rgba(34,197,94,0.2)'}`,
                    }}
                  >
                    {cronStatus.mode === 'local' ? 'LOCALHOST · NODE-CRON' : 'PRODUCTION · SUPABASE PG_CRON'}
                  </span>
                )}
                {cronStatus?.active && (
                  <span className="flex items-center gap-1 text-[10px] text-[#22c55e]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                    {cronStatus.running ? 'RUNNING' : 'ACTIVE'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#475569] mt-0.5">
                {cronStatus?.mode === 'local'
                  ? 'No browser required — runs in the background via Node.js as long as `npm run dev` is open'
                  : 'Fully serverless — Supabase fires HTTP calls on schedule even when your PC is off'}
              </p>
            </div>
          </div>

          {/* Config form (when not active) */}
          {!cronStatus?.active && (
            <div className="flex flex-col gap-3 mb-3">
              {/* Query list */}
              <div>
                <label className="text-[10px] text-[#64748b] font-mono block mb-1.5">SEARCH QUERIES (rotates each run)</label>
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                  {cronQueries.map((q, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#c084fc' }}>
                      {q}
                      <button onClick={() => setCronQueries(prev => prev.filter((_, j) => j !== i))}>
                        <X size={10} style={{ color: '#94a3b8' }} />
                      </button>
                    </span>
                  ))}
                  {cronQueries.length === 0 && (
                    <span className="text-[10px] text-[#475569] italic self-center">Add at least one query to start</span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <input
                    className="alien-input text-xs h-8 flex-1"
                    placeholder={query || 'e.g. realtor, pizza restaurant…'}
                    value={cronQueryInput}
                    onChange={e => setCronQueryInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && cronQueryInput.trim()) {
                        setCronQueries(prev => [...prev, cronQueryInput.trim()])
                        setCronQueryInput('')
                      }
                    }}
                  />
                  <button
                    className="h-8 px-3 rounded-lg text-xs flex items-center gap-1 flex-shrink-0"
                    style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#c084fc' }}
                    onClick={() => { if (cronQueryInput.trim()) { setCronQueries(prev => [...prev, cronQueryInput.trim()]); setCronQueryInput('') } }}
                  >
                    <Plus size={11} /> Add
                  </button>
                </div>
              </div>
              {/* Interval + max leads + cities per query + start row */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#64748b] font-mono">EVERY (MIN)</label>
                  <select className="alien-select-sm" value={cronInterval} onChange={e => setCronInterval(Number(e.target.value))}>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={20}>20 min</option>
                    <option value={35}>35 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#64748b] font-mono">MAX LEADS/RUN</label>
                  <select className="alien-select-sm" value={cronMaxLeads} onChange={e => setCronMaxLeads(Number(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                {cronQueries.length > 1 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#64748b] font-mono">CITIES PER QUERY</label>
                    <select className="alien-select-sm" value={cronRunsPerQuery} onChange={e => setCronRunsPerQuery(Number(e.target.value))}>
                      <option value={1}>1 city then rotate</option>
                      <option value={2}>2 cities then rotate</option>
                      <option value={3}>3 cities then rotate</option>
                      <option value={5}>5 cities then rotate</option>
                      <option value={10}>10 cities then rotate</option>
                    </select>
                  </div>
                )}
                <button
                  className="h-8 px-4 rounded-lg text-xs font-semibold transition-all flex-shrink-0"
                  style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}
                  onClick={() => cronAction('start')}
                  disabled={cronLoading || cronQueries.length === 0}
                >
                  {cronLoading ? '...' : <span className="flex items-center gap-1.5"><Cpu size={12} /> Start Background Cron</span>}
                </button>
              </div>
            </div>
          )}

          {/* Live stats (when active) */}
          {cronStatus?.active && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {[
                  { label: 'Runs',         val: cronStatus.runsCompleted, color: '#a855f7',  ic: <RotateCcw size={10} /> },
                  { label: 'Total Leads',  val: cronStatus.totalLeads,    color: '#38bdf8',  ic: <Map size={10} /> },
                  { label: 'Emails Found', val: cronStatus.totalEmails,   color: '#22d3ee',  ic: <Mail size={10} /> },
                  { label: 'Cities Done',  val: cronStatus.cityIndex,     color: '#fbbf24',  ic: <Activity size={10} /> },
                ].map(s => (
                  <div key={s.label} className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-1 text-[10px] text-[#475569] mb-0.5 truncate">
                      <span style={{ color: s.color }}>{s.ic}</span> {s.label}
                    </div>
                    <div className="text-sm font-mono font-bold leading-tight" style={{ color: s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {cronStatus.lastRunAt && (
                <p className="text-[10px] text-[#475569] mb-2">
                  Last run: {new Date(cronStatus.lastRunAt).toLocaleTimeString()}
                  {cronStatus.lastError && <span className="text-[#f87171] ml-2">⚠ {cronStatus.lastError}</span>}
                  {' · '}
                  Every {cronStatus.intervalMin} min
                  {cronStatus.currentQuery && <span className="text-[#94a3b8] ml-1">· Now: &quot;{cronStatus.currentQuery}&quot;</span>}
                  {cronStatus.queries.length > 1 && (
                    <span className="ml-1">
                      · <span style={{ color: '#a855f7' }}>{cronStatus.queries.length} queries rotating</span>
                    </span>
                  )}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  className="h-7 px-3 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
                  onClick={() => cronAction('stop')}
                  disabled={cronLoading}
                >
                  {cronLoading ? '...' : <span className="flex items-center gap-1.5"><Square size={10} /> Stop Cron</span>}
                </button>
                <button
                  className="h-7 px-3 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#c084fc' }}
                  onClick={() => cronAction('run-now')}
                  disabled={cronLoading || cronStatus.running}
                >
                  <span className="flex items-center gap-1.5"><Zap size={10} /> Run Now</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Pipeline visualization: 3 workers + DB */}
        <div className="flex items-stretch gap-0">
          <WorkerCard
            num={1}
            icon={<Map size={18} />}
            avatar="👽"
            title="Google Maps Scout"
            desc="Headless scrape of Google Maps. Captures company name, phone, full address, city, state, business type, star rating, review count, and hours."
            stats={w1}
            accent="#38bdf8"
          />
          <FlowArrow active={w2.status === 'running' || w2.count > 0} />
          <WorkerCard
            num={2}
            icon={<Globe size={18} />}
            avatar="🛸"
            title="Site Crawler"
            desc="Fetches each business website. Auto falls back to headless Puppeteer for JS-heavy pages. Feeds raw HTML to Worker 3."
            stats={w2}
            accent="#94a3b8"
          />
          <FlowArrow active={w3.status === 'running' || w3.count > 0} />
          <WorkerCard
            num={3}
            icon={<Mail size={18} />}
            avatar="👾"
            title="Data Extractor"
            desc="Mines emails (mailto + regex), social links (IG/FB/LinkedIn), CMS, analytics presence, contact name, role, and form/blog/signup signals. Deep crawls /contact, /team, /staff, /leadership."
            stats={w3}
            accent="#22d3ee"
          />
          <FlowArrow active={saved > 0} />
          <DbNode saved={saved} active={saved > 0} />
        </div>

        {/* Two-column: event log + found emails */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Event log */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'rgba(8,8,14,0.95)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="px-3 py-2 flex items-center gap-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: running ? '#22d3ee' : '#475569' }} />
              <span className="text-xs font-mono text-[#64748b]">PIPELINE LOG</span>
              {running && (
                <span className="ml-auto text-xs font-mono animate-pulse" style={{ color: '#22d3ee' }}>live</span>
              )}
            </div>
            <div className="overflow-y-auto p-3 space-y-0.5" style={{ height: 220, fontFamily: 'monospace' }}>
              {events.length === 0 ? (
                <p className="text-xs text-[#334155] italic">Waiting for pipeline start...</p>
              ) : (
                events.map(ev => (
                  <div key={ev.id} className="flex gap-2 text-xs leading-5">
                    <span className="shrink-0 text-[#334155]">{ev.ts}</span>
                    <span style={{ color: ev.color }}>{ev.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Captured Leads */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'rgba(8,8,14,0.95)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="px-3 py-2 flex items-center gap-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              <Building2 size={12} style={{ color: '#22d3ee' }} />
              <span className="text-xs font-mono text-[#64748b]">CAPTURED LEADS</span>
              <span className="ml-auto text-xs font-mono" style={{ color: '#22d3ee' }}>
                {foundLeads.length}
              </span>
            </div>
            <div className="overflow-y-auto" style={{ height: 220 }}>
              {foundLeads.length === 0 ? (
                <p className="text-xs text-[#334155] italic p-3">No leads captured yet.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Company / Contact', 'Location', 'Phone', 'Website / Tech', 'Email(s)'].map(h => (
                        <th key={h} className="px-2 py-1 text-left text-[10px] font-mono text-[#475569]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {foundLeads.map((lead, i) => (
                      <tr
                        key={i}
                        className="border-b"
                        style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                      >
                        {/* Company + contact name/role */}
                        <td className="px-2 py-1.5 text-xs max-w-[150px]">
                          <span className="block truncate text-white font-medium" title={lead.company_name}>{lead.company_name}</span>
                          {lead.contact_name && (
                            <span className="block truncate text-[#64748b]" title={lead.role || lead.contact_name}>
                              {lead.contact_name}{lead.role ? ` · ${lead.role}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-[#64748b] whitespace-nowrap">
                          {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-[#64748b] font-mono whitespace-nowrap">
                          {lead.phone || '—'}
                        </td>
                        {/* Website + tech badges */}
                        <td className="px-2 py-1.5 text-xs max-w-[130px]">
                          {lead.website
                            ? <>
                                <a
                                  href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-[#38bdf8] hover:underline block truncate"
                                  title={lead.website}
                                >{lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0]}</a>
                                <div className="flex flex-wrap gap-0.5 mt-0.5">
                                  {lead.cms && (
                                    <span className="px-1 rounded text-[9px] font-mono" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>{lead.cms}</span>
                                  )}
                                  {lead.analytics_present && (
                                    <span className="px-1 rounded text-[9px] font-mono" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>📊</span>
                                  )}
                                  {lead.instagram && (
                                    <span className="px-1 rounded text-[9px] font-mono" style={{ background: 'rgba(236,72,153,0.12)', color: '#ec4899' }}>IG</span>
                                  )}
                                  {lead.linkedin_url && (
                                    <span className="px-1 rounded text-[9px] font-mono" style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>in</span>
                                  )}
                                  {lead.has_contact_form && (
                                    <span className="px-1 rounded text-[9px] font-mono" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>form</span>
                                  )}
                                </div>
                              </>
                            : <span className="text-[#334155]">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {lead.emails.length > 0
                            ? <div className="flex flex-col gap-0.5">
                                {lead.emails.map((e, j) => (
                                  <span key={j} className="font-mono" style={{ color: '#22d3ee' }}>{e}</span>
                                ))}
                              </div>
                            : lead.website
                              ? <span className="text-[#334155] italic">scanning…</span>
                              : <span className="text-[#334155]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {foundLeads.length > 0 && (
              <div className="p-2 border-t flex gap-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <button
                  onClick={() => {
                    const allEmails = foundLeads.flatMap(l => l.emails)
                    navigator.clipboard.writeText(allEmails.join('\n'))
                  }}
                  className="flex-1 text-xs py-1.5 rounded-lg transition-all hover:bg-white/5 text-[#64748b] hover:text-white"
                >
                  Copy emails ({foundLeads.filter(l => l.emails.length > 0).length})
                </button>
                <button
                  onClick={() => {
                    const header = 'Company\tContact\tRole\tLocation\tPhone\tWebsite\tCMS\tAnalytics\tInstagram\tLinkedIn\tEmails'
                    const rows = foundLeads.map(l =>
                      `${l.company_name}\t${l.contact_name || ''}\t${l.role || ''}\t${[l.city, l.state].filter(Boolean).join(', ')}\t${l.phone || ''}\t${l.website || ''}\t${l.cms || ''}\t${l.analytics_present ? 'yes' : ''}\t${l.instagram || ''}\t${l.linkedin_url || ''}\t${l.emails.join(', ')}`
                    )
                    navigator.clipboard.writeText([header, ...rows].join('\n'))
                  }}
                  className="flex-1 text-xs py-1.5 rounded-lg transition-all hover:bg-white/5 text-[#64748b] hover:text-white"
                >
                  Copy all as TSV
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Batch Enrich Section ───────────────────────────────────────── */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(10,10,18,0.8)', border: '1px solid rgba(168,85,247,0.2)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}
            >
              <RefreshCw size={15} style={{ color: '#a855f7' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Batch Email Enrichment</h2>
              <p className="text-xs text-[#475569]">
                Process existing leads in your database that have a website URL but no email yet.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {enrichRunning ? (
                <>
                  <span className="text-xs font-mono text-[#a855f7] animate-pulse">
                    {enrichStats.processed}/{enrichStats.total || '?'} leads...
                  </span>
                  <button
                    onClick={stopEnrich}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
                  >
                    <Square size={11} /> Stop
                  </button>
                </>
              ) : (
                <button
                  onClick={startEnrich}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: 'rgba(168,85,247,0.13)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}
                >
                  <Play size={12} />
                  Start Batch Enrich
                </button>
              )}
            </div>
          </div>

          {/* Enrich stats */}
          {(enrichRunning || enrichDone) && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Leads Processed', val: enrichStats.processed, color: '#94a3b8' },
                { label: 'Emails Found', val: enrichStats.emails, color: '#22d3ee' },
                { label: 'Status', val: enrichDone ? 'Done ✓' : 'Running...', color: enrichDone ? '#22c55e' : '#a855f7' },
              ].map(s => (
                <div key={s.label} className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-xs text-[#475569]">{s.label}</div>
                  <div className="text-sm font-mono font-bold leading-tight mt-0.5" style={{ color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Enrich results list */}
          {enrichJobs.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {enrichJobs.map((job, i) => (
                <div key={i} className="rounded-lg px-3 py-2 flex items-start gap-3" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.1)' }}>
                  <CheckCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#a855f7' }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-white">{job.company}</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {job.emails.map((e, j) => (
                        <span key={j} className="text-xs font-mono" style={{ color: '#22d3ee' }}>
                          {e.email}
                          <span className="ml-1 text-[10px] text-[#475569]">({e.confidence})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {enrichDone && enrichJobs.length === 0 && (
            <p className="text-xs text-[#475569] italic text-center py-2">
              No unenriched leads found. All leads with websites already have emails, or Supabase isn&apos;t configured.
            </p>
          )}
        </div>

        {/* How it works */}
        <div
          className="rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4"
          style={{ background: 'rgba(10,10,18,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          {[
            {
              avatar: '👽', color: '#38bdf8', title: 'Worker 1: Google Maps Scout',
              points: [
                'Stealth Puppeteer (no bot detection)',
                'Company, phone, address, city, state',
                'Business type, rating, review count, hours',
              ],
            },
            {
              avatar: '🛸', color: '#94a3b8', title: 'Worker 2: Site Crawler',
              points: [
                'Fast fetch first (12s timeout)',
                'Auto Puppeteer fallback for SPA/JS',
                'Feeds raw HTML to Worker 3',
              ],
            },
            {
              avatar: '👾', color: '#22d3ee', title: 'Worker 3: Data Extractor',
              points: [
                'Emails — mailto (high), regex, deep crawl',
                'Social: Instagram, Facebook, LinkedIn',
                'CMS, analytics, forms, blog, email signup',
                'Contact name + role from /team /leadership',
                'AI agent fills: BANT, size, QR usage',
              ],
            },
          ].map(w => (
            <div key={w.title}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 16, lineHeight: 1 }}>{w.avatar}</span>
                <span className="text-xs font-semibold text-white">{w.title}</span>
              </div>
              <ul className="space-y-1">
                {w.points.map(p => (
                  <li key={p} className="flex items-start gap-1.5 text-xs text-[#475569]">
                    <ChevronRight size={10} className="flex-shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="h-4" />
      </div>
    </div>
  )
}
