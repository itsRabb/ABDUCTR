/**
 * lib/local-cron.ts
 *
 * Background cron singleton for localhost-only usage.
 * Persists across Next.js hot-reloads by storing state on `globalThis`.
 *
 * On production (Vercel / Railway) the cron-control API routes via Supabase
 * pg_cron instead, so this module is never called.
 */

import cron from 'node-cron'

// ─── US Cities pool ───────────────────────────────────────────────────────────
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
  'Stockton CA','Cincinnati OH','St Paul MN','Greensboro NC','Toledo OH',
  'Newark NJ','Plano TX','Henderson NV','Orlando FL','Lincoln NE',
  'Chandler AZ','Fort Wayne IN','Madison WI','Lubbock TX','Scottsdale AZ',
  'Reno NV','Buffalo NY','Durham NC','Glendale AZ','Winston-Salem NC',
  'Hialeah FL','Chesapeake VA','Garland TX','Laredo TX','Gilbert AZ',
  'Baton Rouge LA','Birmingham AL','Rochester NY','Richmond VA','Spokane WA',
  'Des Moines IA','Montgomery AL','Modesto CA','Fayetteville NC','Tacoma WA',
  'Fremont CA','Shreveport LA','Huntsville AL','San Bernardino CA','Knoxville TN',
  'Providence RI','Grand Rapids MI','Salt Lake City UT','Tallahassee FL','Worcester MA',
]

// ─── Shared state (pinned to globalThis so hot-reload doesn't lose it) ────────
interface CronGlobal {
  task: ReturnType<typeof cron.schedule> | null
  config: { queries: string[]; queryIndex: number; runsPerQuery: number; maxLeads: number; intervalMin: number; cityIndex: number } | null
  running: boolean
  runsCompleted: number
  totalLeads: number
  totalEmails: number
  lastRunAt: string | null
  lastError: string | null
}

function getG(): CronGlobal {
  const g = globalThis as Record<string, unknown>
  if (!g.__abductr_cron) {
    g.__abductr_cron = {
      task: null, config: null, running: false,
      runsCompleted: 0, totalLeads: 0, totalEmails: 0,
      lastRunAt: null, lastError: null,
    } satisfies CronGlobal
  }
  return g.__abductr_cron as CronGlobal
}

// ─── Core run logic (called by cron tick) ─────────────────────────────────────
async function doRun() {
  const g = getG()
  if (g.running || !g.config) return
  g.running = true
  g.lastRunAt = new Date().toISOString()
  g.lastError = null

  try {
    const city    = US_CITIES[g.config.cityIndex  % US_CITIES.length]
    const queryStr = g.config.queries[
      Math.floor(g.config.cityIndex / g.config.runsPerQuery) % g.config.queries.length
    ]
    g.config.cityIndex++
    g.config.queryIndex = Math.floor(g.config.cityIndex / g.config.runsPerQuery)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
    const resp = await fetch(`${baseUrl}/api/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: queryStr,
        city,
        maxLeads: g.config.maxLeads,
        autoSave: true,
        deepCrawl: false,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signal: (AbortSignal as any).timeout(6 * 60 * 1000),
    })

    if (resp.ok && resp.body) {
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let leads = 0, emails = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        for (const line of text.split('\n')) {
          if (!line.startsWith('data:')) continue
          try {
            const ev = JSON.parse(line.slice(5).trim())
            if (ev.type === 'stats') {
              leads  = ev.leads  ?? leads
              emails = ev.emails ?? emails
            }
          } catch { /* ignore partial lines */ }
        }
      }
      g.totalLeads  += leads
      g.totalEmails += emails
    } else {
      g.lastError = `HTTP ${resp.status}`
    }
    g.runsCompleted++
  } catch (err) {
    g.lastError = err instanceof Error ? err.message : String(err)
    console.error('[abductr/local-cron] run error:', g.lastError)
  } finally {
    g.running = false
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export interface LocalCronStatus {
  active: boolean
  running: boolean
  runsCompleted: number
  totalLeads: number
  totalEmails: number
  lastRunAt: string | null
  lastError: string | null
  intervalMin: number | null
  runsPerQuery: number
  queries: string[]
  currentQuery: string | null
  queryIndex: number
  cityIndex: number
}

export function startLocalCron(cfg: {
  queries: string[]
  maxLeads: number
  intervalMin: number
  runsPerQuery?: number
}): { ok: boolean; error?: string } {
  const g = getG()
  // Stop any existing job first
  if (g.task) {
    g.task.stop()
    g.task = null
  }

  const intervalMin = Math.max(1, Math.min(60, cfg.intervalMin))
  const expression = `*/${intervalMin} * * * *`

  if (!cron.validate(expression)) {
    return { ok: false, error: `Invalid cron expression: ${expression}` }
  }

  // Reset stats on fresh start
  g.config = { ...cfg, intervalMin, cityIndex: 0, queryIndex: 0, runsPerQuery: cfg.runsPerQuery ?? 1 }
  g.runsCompleted = 0
  g.totalLeads = 0
  g.totalEmails = 0
  g.lastRunAt = null
  g.lastError = null

  g.task = cron.schedule(expression, doRun, { timezone: 'America/New_York' })

  console.log(`[abductr/local-cron] Started — every ${intervalMin}min, queries=[${cfg.queries.join(', ')}]`)
  return { ok: true }
}

export function stopLocalCron() {
  const g = getG()
  if (g.task) {
    g.task.stop()
    g.task = null
  }
  g.config = null
  console.log('[abductr/local-cron] Stopped')
}

export function getLocalCronStatus(): LocalCronStatus {
  const g = getG()
  return {
    active:        g.task !== null,
    running:       g.running,
    runsCompleted: g.runsCompleted,
    totalLeads:    g.totalLeads,
    totalEmails:   g.totalEmails,
    lastRunAt:     g.lastRunAt,
    lastError:     g.lastError,
    intervalMin:   g.config?.intervalMin ?? null,
    runsPerQuery:  g.config?.runsPerQuery ?? 1,
    queries:       g.config?.queries ?? [],
    currentQuery:  g.config
      ? g.config.queries[Math.floor(g.config.cityIndex / g.config.runsPerQuery) % g.config.queries.length] ?? null
      : null,
    queryIndex:    g.config?.queryIndex ?? 0,
    cityIndex:     g.config?.cityIndex ?? 0,
  }
}

/** Trigger an immediate run (useful for "Run Now" button) */
export async function runNowLocalCron() {
  await doRun()
}
