'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, RefreshCw, Wifi, WifiOff, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import type { ProxyEntry } from '@/lib/types'

interface ProxyState {
  proxies: ProxyEntry[]
  total: number
  proxy_enabled: boolean
  proxy_last_refreshed: string | null
}

const REFRESH_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}

export function ProxyPanel() {
  const [state, setState] = useState<ProxyState>({
    proxies: [],
    total: 0,
    proxy_enabled: false,
    proxy_last_refreshed: null,
  })
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [timeDisplay, setTimeDisplay] = useState('')
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchState = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proxies')
      if (res.ok) {
        const data = await res.json()
        setState(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      })
      const data = await res.json()
      if (res.ok) {
        await fetchState()
      } else {
        console.error('Proxy refresh failed:', data)
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleToggle = async () => {
    const newVal = !state.proxy_enabled
    setToggling(true)
    try {
      const res = await fetch('/api/proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', enabled: newVal }),
      })
      if (res.ok) {
        setState(prev => ({ ...prev, proxy_enabled: newVal }))
      }
    } finally {
      setToggling(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchState()
  }, [fetchState])

  // Auto-refresh every 30 min
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      handleRefresh()
    }, REFRESH_INTERVAL_MS)
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live time display
  useEffect(() => {
    const tick = () => setTimeDisplay(timeAgo(state.proxy_last_refreshed))
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [state.proxy_last_refreshed])

  const enabled = state.proxy_enabled
  const hasProxies = state.total > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border overflow-hidden"
      style={{
        background: 'rgba(0,0,0,0.5)',
        borderColor: enabled ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)',
        boxShadow: enabled ? '0 0 20px rgba(74,222,128,0.08)' : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Shield
            size={15}
            style={{ color: enabled ? '#4ade80' : '#6b7280', transition: 'color 0.3s' }}
          />
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: enabled ? '#4ade80' : '#9ca3af', letterSpacing: '0.15em' }}
          >
            Proxy Shield
          </span>

          {/* Status pill */}
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: enabled
                ? 'rgba(74,222,128,0.15)'
                : 'rgba(255,255,255,0.06)',
              color: enabled ? '#4ade80' : '#6b7280',
              border: `1px solid ${enabled ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {enabled ? 'ACTIVE' : 'OFF'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Pool size */}
          {hasProxies && (
            <span className="text-[11px]" style={{ color: '#6b7280' }}>
              {state.total.toLocaleString()} proxies
            </span>
          )}

          {/* Toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="relative w-10 h-5 rounded-full transition-all duration-300 focus:outline-none"
            style={{
              background: enabled ? '#16a34a' : 'rgba(255,255,255,0.1)',
              cursor: toggling ? 'not-allowed' : 'pointer',
              opacity: toggling ? 0.6 : 1,
            }}
            title={enabled ? 'Disable proxy' : 'Enable proxy'}
          >
            <span
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300"
              style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded"
            style={{ color: '#6b7280' }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* ─── Expanded panel ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="px-4 pb-4 pt-0 space-y-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              {/* Info bar */}
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-3">
                  {enabled ? (
                    <Wifi size={12} style={{ color: '#4ade80' }} />
                  ) : (
                    <WifiOff size={12} style={{ color: '#4b5563' }} />
                  )}
                  <span className="text-[11px]" style={{ color: '#6b7280' }}>
                    Last refresh:{' '}
                    <span style={{ color: '#9ca3af' }}>{timeDisplay || '—'}</span>
                  </span>
                  <span className="text-[11px]" style={{ color: '#374151' }}>·</span>
                  <span className="text-[11px]" style={{ color: '#6b7280' }}>
                    Auto-refresh: <span style={{ color: '#9ca3af' }}>every 30 min</span>
                  </span>
                </div>

                {/* Refresh button */}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: refreshing
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(74,222,128,0.12)',
                    color: refreshing ? '#4b5563' : '#4ade80',
                    border: '1px solid rgba(74,222,128,0.2)',
                    cursor: refreshing ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RefreshCw
                    size={11}
                    className={refreshing ? 'animate-spin' : ''}
                  />
                  {refreshing ? 'Fetching...' : 'Refresh Now'}
                </button>
              </div>

              {/* Proxy Sources legend */}
              <div className="flex flex-wrap gap-2">
                {[
                  'ProxyScrape HTTP',
                  'TheSpeedX/PROXY-List',
                  'clarketm/proxy-list',
                ].map(src => (
                  <span
                    key={src}
                    className="text-[10px] px-2 py-0.5 rounded"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      color: '#6b7280',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    {src}
                  </span>
                ))}
              </div>

              {/* Proxy list preview */}
              {state.proxies.length > 0 ? (
                <div
                  className="rounded-lg overflow-y-auto"
                  style={{
                    maxHeight: 140,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {state.proxies.slice(0, 30).map(p => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-1"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    >
                      <span className="font-mono text-[11px]" style={{ color: '#6b7280' }}>
                        {p.host}
                        <span style={{ color: '#374151' }}>:</span>
                        <span style={{ color: '#4b5563' }}>{p.port}</span>
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{
                          background: 'rgba(74,222,128,0.08)',
                          color: '#4ade80',
                          textTransform: 'uppercase',
                        }}
                      >
                        {p.protocol}
                      </span>
                    </div>
                  ))}
                  {state.total > 30 && (
                    <div className="px-3 py-2 text-center text-[10px]" style={{ color: '#374151' }}>
                      +{state.total - 30} more in pool
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="rounded-lg px-4 py-3 text-center text-[11px]"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#4b5563',
                  }}
                >
                  No proxies loaded. Hit <strong>Refresh Now</strong> to fetch a fresh list.
                </div>
              )}

              {/* Warning */}
              <div
                className="flex items-start gap-2 rounded-lg px-3 py-2"
                style={{
                  background: 'rgba(234,179,8,0.06)',
                  border: '1px solid rgba(234,179,8,0.15)',
                }}
              >
                <AlertTriangle size={11} style={{ color: '#ca8a04', marginTop: 1, flexShrink: 0 }} />
                <p className="text-[10px] leading-relaxed" style={{ color: '#92400e' }}>
                  Free proxies are best-effort and may slow scrapes. For high-volume
                  or production use, connect a paid proxy service.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
