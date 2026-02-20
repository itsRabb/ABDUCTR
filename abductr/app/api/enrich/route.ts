import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)] }

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
]

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

function extractEmails(text: string): string[] {
  const deob = text
    .replace(/\[\s*at\s*\]/gi, '@').replace(/\(\s*at\s*\)/gi, '@')
    .replace(/\s+at\s+(?=[a-zA-Z0-9])/gi, '@')
    .replace(/\[\s*dot\s*\]/gi, '.').replace(/&#64;/g, '@')
    .replace(/&#46;/g, '.').replace(/\\u0040/g, '@')
  const found = deob.match(EMAIL_REGEX) || []
  return [...new Set(
    found.map(e => e.toLowerCase().trim()).filter(e =>
      !e.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|ttf|webp|ico)$/i) &&
      !e.includes('example.com') && !e.includes('yourdomain') &&
      !e.includes('sentry.io') && !e.includes('@2x') &&
      !e.startsWith('noreply@') && !e.startsWith('no-reply@') &&
      !e.startsWith('donotreply@') && e.split('@')[1]?.includes('.')
    )
  )]
}

interface EmailHit {
  email: string
  source: 'mailto' | 'regex' | 'deep_crawl'
  confidence: 'high' | 'medium' | 'low'
  source_url: string
}

const CONTACT_PATHS = ['/contact', '/contact-us', '/about', '/about-us', '/team', '/staff', '/agents', '/directory']

async function enrichWebsite(website: string, deepCrawl: boolean): Promise<EmailHit[]> {
  const baseUrl = website.startsWith('http') ? website : `https://${website}`
  const hits: EmailHit[] = []
  const seen = new Set<string>()
  const ua = pick(USER_AGENTS)

  const scanPage = async (url: string, source: 'mailto' | 'regex' | 'deep_crawl') => {
    try {
      const ctrl = new AbortController()
      setTimeout(() => ctrl.abort(), 10000)
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': ua, 'Accept': 'text/html,*/*;q=0.8' },
        redirect: 'follow',
      })
      if (!res.ok) return
      const html = await res.text()

      // mailto links — high confidence
      const mailtoRx = /<a[^>]+href=["']mailto:([^"'?# ]+)[^>]*>/gi
      let m
      while ((m = mailtoRx.exec(html)) !== null) {
        const email = m[1].trim().toLowerCase()
        if (email.includes('@') && !seen.has(email)) {
          seen.add(email)
          hits.push({ email, source: 'mailto', confidence: 'high', source_url: url })
        }
      }

      // Regex sweep — medium/low confidence
      for (const email of extractEmails(html)) {
        if (!seen.has(email)) {
          seen.add(email)
          hits.push({ email, source, confidence: source === 'deep_crawl' ? 'medium' : 'low', source_url: url })
        }
      }
    } catch { /* best effort */ }
  }

  await scanPage(baseUrl, 'regex')

  if (deepCrawl) {
    try {
      const origin = new URL(baseUrl).origin
      for (const path of CONTACT_PATHS) {
        if (hits.filter(h => h.confidence === 'high').length >= 2) break
        try {
          const ctrl = new AbortController()
          setTimeout(() => ctrl.abort(), 4000)
          const probe = await fetch(`${origin}${path}`, { signal: ctrl.signal, redirect: 'follow' })
          if (probe.ok) await scanPage(`${origin}${path}`, 'deep_crawl')
        } catch { /* skip */ }
        await delay(200)
      }
    } catch { /* invalid URL */ }
  }

  return hits
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { leadIds, deepCrawl = true, limit = 50 }: {
    leadIds?: string[]
    deepCrawl?: boolean
    limit?: number
  } = body

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`))
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      ) as any // eslint-disable-line @typescript-eslint/no-explicit-any

      try {
        // Fetch leads to enrich
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query: any = supabase
          .from('leads')
          .select('id, company_name, website, email')
          .not('website', 'is', null)
          .neq('website', '')
          .limit(limit)

        if (leadIds && leadIds.length > 0) {
          query = supabase
            .from('leads')
            .select('id, company_name, website, email')
            .in('id', leadIds)
        } else {
          // Only leads with no email yet
          query = query.is('email', null)
        }

        const { data: leads, error } = await query
        if (error) { send({ type: 'error', message: error.message }); controller.close(); return }
        if (!leads || leads.length === 0) {
          send({ type: 'done', data: { processed: 0, emails_found: 0, message: 'No leads need enrichment' } })
          controller.close()
          return
        }

        send({ type: 'status', message: `Found ${leads.length} leads to enrich` })
        let totalEmails = 0

        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i]
          send({ type: 'progress', data: { current: i + 1, total: leads.length, company: lead.company_name, website: lead.website } })

          const hits = await enrichWebsite(lead.website, deepCrawl)

          if (hits.length > 0) {
            totalEmails += hits.length

            // Update primary email on leads table if none set
            if (!lead.email) {
              const best = hits.find(h => h.confidence === 'high') || hits[0]
              await supabase.from('leads').update({ email: best.email }).eq('id', lead.id)
            }

            // Insert into extracted_emails
            const rows = hits.map(h => ({
              lead_id: lead.id,
              email: h.email,
              confidence: h.confidence,
              source: h.source,
              source_url: h.source_url,
            }))
            await supabase.from('extracted_emails').upsert(rows, {
              onConflict: 'lead_id,email', ignoreDuplicates: true,
            })

            send({
              type: 'enriched',
              data: {
                lead_id: lead.id,
                company: lead.company_name,
                emails: hits.map(h => ({ email: h.email, source: h.source, confidence: h.confidence })),
              },
            })
          } else {
            send({ type: 'no_email', data: { lead_id: lead.id, company: lead.company_name } })
          }

          // Polite delay between sites
          if (i < leads.length - 1) await delay(randInt(400, 900))
        }

        send({ type: 'done', data: { processed: leads.length, emails_found: totalEmails } })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Enrichment error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
