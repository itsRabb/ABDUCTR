// app/api/proxies/route.ts
// Proxy management API
//
// GET  → { proxies: ProxyEntry[], proxy_enabled: boolean, proxy_last_refreshed: string | null, total: number }
// POST { action: 'toggle', enabled: boolean } → toggle proxy on/off
// POST { action: 'refresh' }                  → fetch fresh list from 3 free sources

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// ─── Free proxy sources (HTTP) ─────────────────────────────────────────────
// All return one "host:port" per line (plain text).
const PROXY_SOURCES = [
  // ProxyScrape HTTP (largest, fastest)
  'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
  // TheSpeedX GitHub list — maintained daily
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
  // clarketm GitHub list — well-maintained
  'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
]

function parseProxyLines(text: string): { host: string; port: number }[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^\d{1,3}(\.\d{1,3}){3}:\d{2,5}$/.test(l))
    .map(l => {
      const [host, portStr] = l.split(':')
      return { host, port: parseInt(portStr, 10) }
    })
    .filter(p => p.port > 0 && p.port < 65536)
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const db = supabase()

  const [proxiesRes, settingsRes] = await Promise.all([
    db.from('proxies').select('*').order('last_checked', { ascending: false }).limit(500),
    db.from('app_settings').select('*').eq('id', 1).single(),
  ])

  return NextResponse.json({
    proxies: proxiesRes.data ?? [],
    total: proxiesRes.data?.length ?? 0,
    proxy_enabled: settingsRes.data?.proxy_enabled ?? false,
    proxy_last_refreshed: settingsRes.data?.proxy_last_refreshed ?? null,
  })
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = supabase()

  // ── Toggle proxy on/off ──────────────────────────────────────────────────
  if (body.action === 'toggle') {
    const { error } = await db
      .from('app_settings')
      .upsert({ id: 1, proxy_enabled: body.enabled, updated_at: new Date().toISOString() })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ proxy_enabled: body.enabled })
  }

  // ── Refresh proxy list ───────────────────────────────────────────────────
  if (body.action === 'refresh') {
    const fetched: { host: string; port: number }[] = []

    // Fetch from all sources in parallel — ignore individual failures
    const results = await Promise.allSettled(
      PROXY_SOURCES.map(url =>
        fetch(url, {
          signal: AbortSignal.timeout(12000),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        })
          .then(r => r.text())
          .then(text => parseProxyLines(text))
      )
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        fetched.push(...result.value)
      }
    }

    // Deduplicate by host:port
    const seen = new Set<string>()
    const unique = fetched.filter(p => {
      const key = `${p.host}:${p.port}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (unique.length === 0) {
      return NextResponse.json({ error: 'No proxies fetched from any source' }, { status: 502 })
    }

    // Upsert in batches of 500 (Supabase row limit per request)
    const now = new Date().toISOString()
    const rows = unique.map(p => ({
      host: p.host,
      port: p.port,
      protocol: 'http',
      last_checked: now,
    }))

    let inserted = 0
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const { error } = await db
        .from('proxies')
        .upsert(chunk, { onConflict: 'host,port', ignoreDuplicates: false })
      if (!error) inserted += chunk.length
    }

    // Update last-refreshed timestamp
    await db
      .from('app_settings')
      .upsert({ id: 1, proxy_last_refreshed: now, updated_at: now })

    return NextResponse.json({
      fetched: unique.length,
      inserted,
      sources: results.map((r, i) => ({
        url: PROXY_SOURCES[i],
        ok: r.status === 'fulfilled',
        count: r.status === 'fulfilled' ? r.value.length : 0,
      })),
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
