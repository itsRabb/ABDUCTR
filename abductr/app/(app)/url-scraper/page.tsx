'use client'
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, Zap, Search, ChevronRight, Copy, Download, Globe, Mail, User, Building2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { TopNav } from '@/components/TopNav'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmailResult {
  id: string
  email: string
  name?: string
  role?: string
  phone?: string
  company_name: string
  source_url: string
  source_type: 'mailto' | 'regex' | 'table' | 'deep_crawl'
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  mailto:     { label: 'mailto:', color: '#22d3ee' },
  table:      { label: 'Table',   color: '#a3e635' },
  deep_crawl: { label: 'Deep',    color: '#c026d3' },
  regex:      { label: 'Scan',    color: '#fb923c' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function UrlScraperPage() {
  const [urlInput, setUrlInput] = useState('')
  const [deepCrawl, setDeepCrawl] = useState(true)
  const [autoSave, setAutoSave] = useState(false)
  const [running, setRunning] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [results, setResults] = useState<EmailResult[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const counterRef = useRef(0)

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const selectAll = () => setSelected(new Set(results.map(r => r.id)))
  const selectNone = () => setSelected(new Set())

  const handleScan = async () => {
    const urls = urlInput.split('\n').map(u => u.trim()).filter(Boolean)
    if (!urls.length) { toast.error('Paste at least one URL'); return }

    setRunning(true)
    setDone(false)
    setResults([])
    setSelected(new Set())
    setStatusMsg('Initializing scan...')
    counterRef.current = 0

    try {
      const res = await fetch('/api/scrape-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ urls, deepCrawl, saveToDb: autoSave }),
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
            if (event.type === 'status') {
              setStatusMsg(event.message)
            } else if (event.type === 'email') {
              const id = `${event.email}-${Date.now()}-${counterRef.current++}`
              const result: EmailResult = {
                id,
                email: event.email,
                name: event.name,
                role: event.role,
                phone: event.phone,
                company_name: event.company_name,
                source_url: event.source_url,
                source_type: event.source_type,
              }
              setResults(prev => [...prev, result])
              // Auto-select new results
              setSelected(prev => { const s = new Set(prev); s.add(id); return s })
            } else if (event.type === 'done') {
              setDone(true)
              setRunning(false)
              setStatusMsg('')
              toast.success(`Found ${event.total} email${event.total !== 1 ? 's' : ''}`)
            } else if (event.type === 'error') {
              toast.error(event.message)
              setRunning(false)
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed')
      setRunning(false)
    }
  }

  const handleBeamSelected = async () => {
    const toSave = results.filter(r => selected.has(r.id))
    if (!toSave.length) { toast.error('No emails selected'); return }
    setSaving(true)
    const supabase = createClient()
    let saved = 0
    let skipped = 0

    for (const r of toSave) {
      try {
        const { count } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .ilike('email', r.email)
        if (count && count > 0) { skipped++; continue }

        const { error } = await supabase.from('leads').insert({
          company_name: r.company_name,
          email: r.email,
          contact_name: r.name ?? null,
          role: r.role ?? null,
          phone: r.phone ?? null,
          website: r.source_url,
        })
        if (!error) saved++
        else skipped++
      } catch { skipped++ }
    }

    setSaving(false)
    toast.success(`Beamed ${saved} leads to DB${skipped > 0 ? ` (${skipped} skipped — already exist)` : ''}`)
  }

  const handleCopyAll = () => {
    const text = results.map(r => r.email).join('\n')
    navigator.clipboard.writeText(text)
    toast.success(`Copied ${results.length} emails`)
  }

  const handleCsvExport = () => {
    const rows = [
      ['Email', 'Name', 'Role', 'Phone', 'Company', 'Source URL', 'Source Type'],
      ...results.map(r => [
        r.email, r.name || '', r.role || '', r.phone || '',
        r.company_name, r.source_url, r.source_type,
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `emails-${Date.now()}.csv`
    a.click()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopNav />
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)' }}>
              <Mail size={16} style={{ color: '#22d3ee' }} />
            </div>
            <h1
              className="text-2xl font-black text-white tracking-[0.12em] uppercase"
              style={{ fontFamily: 'var(--font-display, Orbitron), monospace' }}
            >
              <span style={{ color: '#22d3ee' }}>Email</span> Harvester
            </h1>
          </div>
          <p className="text-sm text-[#64748b] ml-11">
            Paste any URL — realtor directories, team pages, contact pages. We extract every accessible email.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto grid grid-cols-5 gap-4 items-start">

          {/* Left — Input panel */}
          <motion.div
            className="col-span-2 glass-card rounded-2xl p-5 space-y-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, #22d3ee, #c026d3, transparent)' }} />

            {/* URL input */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#64748b] mb-2">
                <Link2 size={10} className="inline mr-1" />
                Target URLs (one per line, max 20)
              </label>
              <textarea
                className="alien-input w-full text-xs resize-none font-mono"
                rows={8}
                placeholder={`https://myrealtysite.com/agents\nhttps://bestbrokers.com/team\nhttps://realtors.example.com/directory`}
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                disabled={running}
                style={{ fontSize: '11px', lineHeight: '1.6' }}
              />
              <p className="text-[10px] text-[#334155] mt-1">
                Works on realtor directories, company pages, team lists, any page with public emails
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-[#475569]">Options</p>

              {/* Deep crawl toggle */}
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="text-xs text-[#94a3b8] group-hover:text-white transition-colors">
                    Deep Crawl
                  </p>
                  <p className="text-[10px] text-[#334155]">
                    Also scans /contact /about /team /agents /staff pages
                  </p>
                </div>
                <button
                  onClick={() => setDeepCrawl(v => !v)}
                  disabled={running}
                  className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                  style={{
                    background: deepCrawl ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.08)',
                    border: deepCrawl ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                    style={{
                      background: deepCrawl ? '#22d3ee' : '#334155',
                      left: deepCrawl ? '22px' : '2px',
                    }}
                  />
                </button>
              </label>

              {/* Auto-save toggle */}
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="text-xs text-[#94a3b8] group-hover:text-white transition-colors">
                    Auto-Save to DB
                  </p>
                  <p className="text-[10px] text-[#334155]">
                    Instantly beams each email to leads as it's found
                  </p>
                </div>
                <button
                  onClick={() => setAutoSave(v => !v)}
                  disabled={running}
                  className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                  style={{
                    background: autoSave ? 'rgba(192,38,211,0.3)' : 'rgba(255,255,255,0.08)',
                    border: autoSave ? '1px solid rgba(192,38,211,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                    style={{
                      background: autoSave ? '#c026d3' : '#334155',
                      left: autoSave ? '22px' : '2px',
                    }}
                  />
                </button>
              </label>
            </div>

            {/* Scan button */}
            <button
              onClick={handleScan}
              disabled={running}
              className="btn-plasma w-full text-sm py-4 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Search size={16} />
                  </motion.div>
                  Scanning... ({results.length} found)
                </>
              ) : (
                <>
                  <Zap size={16} />
                  HARVEST EMAILS
                </>
              )}
            </button>

            {/* Live status */}
            <AnimatePresence>
              {(running && statusMsg) && (
                <motion.p
                  key={statusMsg}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] text-center font-mono truncate"
                  style={{ color: '#22d3ee' }}
                >
                  {statusMsg}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Source legend */}
            <div className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
              <p className="text-[9px] uppercase tracking-widest text-[#334155] mb-2">Source Confidence</p>
              <div className="space-y-1">
                {Object.entries(SOURCE_BADGE).map(([key, b]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                      style={{ background: b.color + '20', color: b.color, border: `1px solid ${b.color}40` }}>
                      {b.label}
                    </span>
                    <span className="text-[9px] text-[#334155]">
                      {key === 'mailto' && 'Direct link — highest quality'}
                      {key === 'table' && 'Structured table — very reliable'}
                      {key === 'deep_crawl' && 'Sub-page (contact/team) — high quality'}
                      {key === 'regex' && 'Pattern scan — review before use'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right — Results panel */}
          <motion.div
            className="col-span-3 glass-card rounded-2xl flex flex-col"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            style={{ minHeight: 520 }}
          >
            {/* Results toolbar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
              <Mail size={13} style={{ color: '#22d3ee' }} />
              <h3 className="text-[10px] uppercase tracking-widest font-semibold"
                style={{ color: '#22d3ee', fontFamily: 'var(--font-display, Orbitron), monospace' }}>
                Harvested Emails
              </h3>
              {results.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }}>
                  {results.length}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {results.length > 0 && (
                  <>
                    <button onClick={selectAll} className="text-[10px] text-[#64748b] hover:text-white transition-colors">
                      All
                    </button>
                    <span className="text-[#334155]">·</span>
                    <button onClick={selectNone} className="text-[10px] text-[#64748b] hover:text-white transition-colors">
                      None
                    </button>
                    <span className="text-[#334155]">·</span>
                    <button onClick={handleCopyAll} className="text-[10px] text-[#64748b] hover:text-[#22d3ee] transition-colors flex items-center gap-1">
                      <Copy size={11} />Copy all
                    </button>
                    <span className="text-[#334155]">·</span>
                    <button onClick={handleCsvExport} className="text-[10px] text-[#64748b] hover:text-[#a3e635] transition-colors flex items-center gap-1">
                      <Download size={11} />CSV
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 420 }}>
              {results.length === 0 && !running && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="text-4xl mb-3">📡</div>
                  <p className="text-xs text-[#475569]">Paste URLs and hit HARVEST EMAILS</p>
                  <p className="text-[10px] text-[#334155] mt-1 max-w-xs">
                    Works great on directory pages, realtor sites, company team pages — anywhere emails are publicly listed
                  </p>
                </div>
              )}

              <AnimatePresence>
                {results.map((r) => {
                  const badge = SOURCE_BADGE[r.source_type] || SOURCE_BADGE.regex
                  const checked = selected.has(r.id)
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors group"
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(r.id)}
                        className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all"
                        style={{
                          background: checked ? '#22d3ee' : 'transparent',
                          border: checked ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.15)',
                        }}
                      >
                        {checked && <span className="text-black text-[9px] font-bold">✓</span>}
                      </button>

                      {/* Email */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-white truncate" style={{ maxWidth: 220 }}>
                            {r.email}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                            style={{ background: badge.color + '20', color: badge.color, border: `1px solid ${badge.color}40` }}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {r.name && (
                            <span className="text-[10px] text-[#64748b] flex items-center gap-1">
                              <User size={9} />{r.name}
                            </span>
                          )}
                          {r.role && (
                            <span className="text-[10px] text-[#475569] flex items-center gap-1">
                              <Building2 size={9} />{r.role}
                            </span>
                          )}
                          {r.phone && (
                            <span className="text-[10px] text-[#475569]">{r.phone}</span>
                          )}
                          <span className="text-[9px] text-[#334155] flex items-center gap-1 truncate max-w-[200px]">
                            <Globe size={8} className="flex-shrink-0" />
                            {r.company_name}
                          </span>
                        </div>
                      </div>

                      {/* Source URL */}
                      <a
                        href={r.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title={r.source_url}
                      >
                        <ExternalLink size={11} style={{ color: '#475569' }} />
                      </a>

                      {/* Copy email */}
                      <button
                        onClick={() => { navigator.clipboard.writeText(r.email); toast.success('Copied!') }}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy size={11} style={{ color: '#475569' }} />
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* Bottom action bar */}
            {(results.length > 0 || done) && (
              <div className="flex items-center gap-3 px-5 py-3 border-t border-[rgba(255,255,255,0.06)]">
                <span className="text-[10px] text-[#64748b]">
                  {selected.size} selected of {results.length}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {done && !autoSave && (
                    <button
                      onClick={handleBeamSelected}
                      disabled={saving || selected.size === 0}
                      className="btn-cyan text-xs px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                          Beaming...
                        </motion.span>
                      ) : (
                        <>
                          <Zap size={12} />
                          Beam {selected.size > 0 ? `${selected.size} ` : ''}to Leads DB
                          <ChevronRight size={12} />
                        </>
                      )}
                    </button>
                  )}
                  {autoSave && done && (
                    <span className="text-[10px] text-[#a3e635]">
                      ✓ All auto-saved to leads DB
                    </span>
                  )}
                </div>
              </div>
            )}
          </motion.div>

        </div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="max-w-6xl mx-auto mt-4 glass-card rounded-xl p-4"
        >
          <p className="text-[10px] uppercase tracking-widest text-[#334155] mb-2">Pro Tips for Email Harvesting</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              ['Realtor Directories', 'Paste the /agents or /directory page. Deep Crawl finds individual broker contact pages automatically.'],
              ['HTML Tables', 'Auto-detected. If a site has name/email/phone in a table, every row becomes a lead.'],
              ['Obfuscated Emails', 'Handles "name [at] domain [dot] com", HTML entities, and Unicode encoding tricks sites use to hide emails from bots.'],
            ].map(([title, tip]) => (
              <div key={title}>
                <p className="text-[10px] text-[#94a3b8] font-semibold mb-1">{title}</p>
                <p className="text-[9px] text-[#475569] leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
