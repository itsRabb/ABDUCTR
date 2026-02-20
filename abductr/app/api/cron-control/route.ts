/**
 * app/api/cron-control/route.ts
 *
 * Unified start/stop/status endpoint for the background 24/7 cron.
 *
 * Detection logic:
 *   - NODE_ENV === 'development'  → localhost mode  → node-cron singleton
 *   - NODE_ENV === 'production'   → deployed mode   → Supabase pg_cron flag
 *
 * GET  /api/cron-control          → current status + mode
 * POST /api/cron-control  { action: 'start'|'stop'|'run-now', query, intervalMin, maxLeads }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  startLocalCron,
  stopLocalCron,
  getLocalCronStatus,
  runNowLocalCron,
} from '@/lib/local-cron'
import { createClient } from '@supabase/supabase-js'

// ─── Environment detection ────────────────────────────────────────────────────
function detectMode(): 'local' | 'production' {
  // Explicit override via env
  if (process.env.CRON_MODE === 'local')      return 'local'
  if (process.env.CRON_MODE === 'production') return 'production'

  // Auto: dev = local, any deployed env = production
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (
    process.env.NODE_ENV === 'development' ||
    appUrl === '' ||
    appUrl.includes('localhost') ||
    appUrl.includes('127.0.0.1')
  ) {
    return 'local'
  }
  return 'production'
}

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE env vars')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(url, key) as any
}

// ─── GET — current status ──────────────────────────────────────────────────────
export async function GET() {
  const mode = detectMode()

  if (mode === 'local') {
    return NextResponse.json({ mode, ...getLocalCronStatus() })
  }

  // Production: read Supabase flag
  try {
    const sb = makeSupabase()
    const { data } = await sb
      .from('app_settings')
      .select('pipeline_enabled, pipeline_query, pipeline_maxleads')
      .eq('id', 1)
      .single()

    return NextResponse.json({
      mode,
      active:    data?.pipeline_enabled   ?? false,
      query:     data?.pipeline_query     ?? null,
      maxLeads:  data?.pipeline_maxleads  ?? 20,
    })
  } catch (err) {
    return NextResponse.json({
      mode,
      active: false,
      error: err instanceof Error ? err.message : 'Supabase error',
    })
  }
}

// ─── POST — start / stop / run-now ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { action, query = 'plumber', queries, intervalMin = 35, maxLeads = 20, runsPerQuery = 1 } = body as {
    action: 'start' | 'stop' | 'run-now'
    query?: string
    queries?: string[]
    intervalMin?: number
    maxLeads?: number
    runsPerQuery?: number
  }

  // queries array takes precedence; fall back to single query string
  const resolvedQueries: string[] = (Array.isArray(queries) && queries.length > 0)
    ? queries
    : [query]

  const mode = detectMode()

  // ── LOCAL (node-cron singleton) ──────────────────────────────────────────
  if (mode === 'local') {
    if (action === 'start') {
      const result = startLocalCron({ queries: resolvedQueries, maxLeads, intervalMin, runsPerQuery })
      return NextResponse.json({ mode, ...result, ...getLocalCronStatus() })
    }

    if (action === 'stop') {
      stopLocalCron()
      return NextResponse.json({ mode, ok: true, active: false })
    }

    if (action === 'run-now') {
      // fire immediately without waiting (returns immediately, runs async)
      runNowLocalCron().catch(console.error)
      return NextResponse.json({ mode, ok: true, message: 'Run triggered' })
    }

    return NextResponse.json({ mode, ok: false, error: 'Unknown action' }, { status: 400 })
  }

  // ── PRODUCTION (Supabase pg_cron) ────────────────────────────────────────
  try {
    const sb = makeSupabase()

    if (action === 'start') {
      await sb.from('app_settings').upsert({
        id: 1,
        pipeline_enabled: true,
        pipeline_query:   query,
        pipeline_maxleads: maxLeads,
      })
      return NextResponse.json({ mode, ok: true, active: true })
    }

    if (action === 'stop') {
      await sb.from('app_settings').update({ pipeline_enabled: false }).eq('id', 1)
      return NextResponse.json({ mode, ok: true, active: false })
    }

    return NextResponse.json({ mode, ok: false, error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { mode, ok: false, error: err instanceof Error ? err.message : 'Supabase error' },
      { status: 500 }
    )
  }
}
