import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// ─── Email extraction ─────────────────────────────────────────────────────────
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

function extractEmails(text: string): string[] {
  const deob = text
    .replace(/\[\s*at\s*\]/gi, '@')
    .replace(/\(\s*at\s*\)/gi, '@')
    .replace(/\s+at\s+(?=[a-zA-Z0-9])/gi, '@')
    .replace(/\[\s*dot\s*\]/gi, '.')
    .replace(/\(\s*dot\s*\)/gi, '.')
    .replace(/&#64;/g, '@')
    .replace(/&#46;/g, '.')
    .replace(/&amp;/g, '&')
    // Handle Unicode obfuscation e.g. \u0040
    .replace(/\\u0040/g, '@')
    .replace(/\\u002e/gi, '.')
  const found = deob.match(EMAIL_REGEX) || []
  return [...new Set(
    found
      .map(e => e.toLowerCase().trim())
      .filter(e =>
        !e.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|ttf|webp|ico|mp4|pdf)$/i) &&
        !e.includes('example.com') &&
        !e.includes('yourdomain') &&
        !e.includes('domain.com') &&
        !e.includes('sentry.io') &&
        !e.includes('email.com') &&
        !e.includes('@2x') &&
        !e.startsWith('noreply@') &&
        !e.startsWith('no-reply@') &&
        !e.startsWith('donotreply@') &&
        e.split('@')[1]?.includes('.')
      )
  )]
}

function extractMailtoLeads(html: string): Array<{ email: string; label: string }> {
  const results: Array<{ email: string; label: string }> = []
  const regex = /<a[^>]+href=["']mailto:([^"'?# ]+)[^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    const email = match[1].trim().toLowerCase()
    const label = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (email && email.includes('@') && email.includes('.')) {
      results.push({ email, label })
    }
  }
  return results
}

// ─── Table extraction ─────────────────────────────────────────────────────────
const NAME_COLS = ['name', 'full name', 'fullname', 'contact', 'first name', 'last name', 'agent', 'agent name', 'realtor']
const EMAIL_COLS = ['email', 'e-mail', 'email address', 'mail']
const PHONE_COLS = ['phone', 'telephone', 'tel', 'mobile', 'cell', 'number']
const ROLE_COLS = ['role', 'title', 'position', 'job', 'job title', 'designation', 'department']
const COMPANY_COLS = ['company', 'business', 'organization', 'employer', 'firm', 'office', 'brokerage']

function matchesAny(header: string, patterns: string[]): boolean {
  return patterns.some(p => header.includes(p))
}

interface TableLead {
  email: string
  name?: string
  role?: string
  phone?: string
  company_name: string
  source_url: string
  source_type: 'table'
}

function extractTableLeads(html: string, sourceUrl: string, defaultCompany: string): TableLead[] {
  const leads: TableLead[] = []
  const tableRegex = /<table[\s\S]*?<\/table>/gi
  const tableMatches = [...html.matchAll(/<table([\s\S]*?)<\/table>/gi)]

  for (const tableMatch of tableMatches) {
    const tableHtml = tableMatch[0]
    const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    if (rowMatches.length < 2) continue

    const parseRow = (rowHtml: string): string[] =>
      [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())

    const headerCells = parseRow(rowMatches[0][1]).map(h => h.toLowerCase())

    // Map columns
    const col: Record<string, number> = {}
    headerCells.forEach((h, i) => {
      if (matchesAny(h, EMAIL_COLS)) col.email = i
      else if (matchesAny(h, NAME_COLS) && col.name === undefined) col.name = i
      else if (h === 'first' || h === 'first name') col.first = i
      else if (h === 'last' || h === 'last name') col.last = i
      else if (matchesAny(h, PHONE_COLS)) col.phone = i
      else if (matchesAny(h, ROLE_COLS)) col.role = i
      else if (matchesAny(h, COMPANY_COLS)) col.company = i
    })

    // Need at least email or name to bother
    if (col.email === undefined && col.name === undefined && col.first === undefined) continue

    for (let r = 1; r < rowMatches.length; r++) {
      const cells = parseRow(rowMatches[r][1])
      const c = (k: string | undefined): string => k !== undefined && col[k] !== undefined ? (cells[col[k]] || '').trim() : ''

      let email = c('email')
      if (!email) {
        for (const cell of cells) {
          const found = extractEmails(cell)
          if (found.length) { email = found[0]; break }
        }
      }
      if (!email) continue

      const name = c('name') || [c('first'), c('last')].filter(Boolean).join(' ') || undefined
      leads.push({
        email: email.toLowerCase(),
        name: name || undefined,
        role: c('role') || undefined,
        phone: c('phone') || undefined,
        company_name: c('company') || defaultCompany,
        source_url: sourceUrl,
        source_type: 'table',
      })
    }
  }

  // Suppress TS warning
  void tableRegex
  return leads
}

// ─── Company name extraction ──────────────────────────────────────────────────
function getCompanyName(html: string, url: string): string {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
  if (og) return og[1].trim()
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (title) {
    return title[1]
      .replace(/\s*[|–\-—]\s*.+$/, '')
      .trim()
      .substring(0, 80)
  }
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────
const SCRAPER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

async function fetchHtmlBasic(url: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': SCRAPER_UA, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

async function fetchHtmlPuppeteer(url: string): Promise<string> {
  let browser
  try {
    const puppeteer = await import('puppeteer')
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    })
    const page = await browser.newPage()
    await page.setUserAgent(SCRAPER_UA)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 })
    // Scroll to trigger lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await new Promise(r => setTimeout(r, 1500))
    return await page.content()
  } catch {
    return ''
  } finally {
    if (browser) await browser.close().catch(() => null)
  }
}

async function smartFetch(url: string, send: (d: object) => void): Promise<string> {
  let html = await fetchHtmlBasic(url)
  // Need JS rendering if: very short, no emails, no interesting content
  const looksEmpty = html.length < 4000 || (!html.includes('@') && !html.includes('mailto'))
  if (looksEmpty) {
    send({ type: 'status', message: `Rendering JS: ${url}` })
    const rendered = await fetchHtmlPuppeteer(url)
    if (rendered.length > html.length) html = rendered
  }
  return html
}

// ─── Sub-pages to deep crawl ──────────────────────────────────────────────────
const CONTACT_PATHS = [
  '/contact', '/contact-us', '/contact.html', '/contact-us.html',
  '/about', '/about-us', '/about.html',
  '/team', '/our-team', '/the-team', '/team.html',
  '/staff', '/our-staff', '/staff.html',
  '/people', '/directory', '/agents', '/agents.html',
  '/meet-the-team', '/meet-us',
]

// ─── Lead type ───────────────────────────────────────────────────────────────
interface EmailLead {
  email: string
  name?: string
  role?: string
  phone?: string
  company_name: string
  source_url: string
  source_type: 'mailto' | 'regex' | 'table' | 'deep_crawl'
}

// ─── Process one URL ─────────────────────────────────────────────────────────
async function scrapeUrl(
  rawUrl: string,
  isSubpage: boolean,
  deepCrawl: boolean,
  seen: Set<string>,
  send: (d: object) => void,
  saveToDb: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<number> {
  let count = 0
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

  send({ type: 'status', message: `Scanning: ${url}` })
  const html = await smartFetch(url, send)
  if (!html) return 0

  const company = getCompanyName(html, url)

  const emit = async (lead: EmailLead) => {
    if (seen.has(lead.email)) return
    seen.add(lead.email)
    count++
    send({ type: 'email', ...lead })
    if (saveToDb && supabase) {
      try {
        const { count: exists } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .ilike('email', lead.email)
        if (!exists || exists === 0) {
          await supabase.from('leads').insert({
            company_name: lead.company_name,
            email: lead.email,
            contact_name: lead.name ?? null,
            role: lead.role ?? null,
            phone: lead.phone ?? null,
            website: lead.source_url,
          })
        }
      } catch { /* best effort */ }
    }
  }

  // 1. mailto: links (highest confidence — often have a name label)
  for (const { email, label } of extractMailtoLeads(html)) {
    const nameIsActualLabel = label && label.length > 1 && !label.includes('@') && !label.toLowerCase().startsWith('email')
    await emit({
      email,
      name: nameIsActualLabel ? label : undefined,
      company_name: company,
      source_url: url,
      source_type: 'mailto',
    })
  }

  // 2. Table detection (structured data — higher confidence than raw regex)
  for (const lead of extractTableLeads(html, url, company)) {
    await emit(lead)
  }

  // 3. Regex sweep (catch everything else)
  for (const email of extractEmails(html)) {
    await emit({
      email,
      company_name: company,
      source_url: url,
      source_type: 'regex',
    })
  }

  // 4. Deep crawl sub-pages
  if (deepCrawl && !isSubpage) {
    let base: URL
    try { base = new URL(url) } catch { return count }

    for (const path of CONTACT_PATHS) {
      const subUrl = `${base.protocol}//${base.host}${path}`
      try {
        const subHtml = await fetchHtmlBasic(subUrl)
        if (!subHtml || subHtml.length < 800) continue
        send({ type: 'status', message: `Deep crawl: ${subUrl}` })

        for (const { email, label } of extractMailtoLeads(subHtml)) {
          const nameIsLabel = label && !label.includes('@') && !label.toLowerCase().startsWith('email')
          await emit({ email, name: nameIsLabel ? label : undefined, company_name: company, source_url: subUrl, source_type: 'deep_crawl' })
        }
        for (const lead of extractTableLeads(subHtml, subUrl, company)) {
          await emit(lead)
        }
        for (const email of extractEmails(subHtml)) {
          await emit({ email, company_name: company, source_url: subUrl, source_type: 'deep_crawl' })
        }
      } catch { /* sub-page 404 / timeout */ }
    }
  }

  return count
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { urls = [], deepCrawl = false, saveToDb = false } = body as {
    urls: string[]
    deepCrawl: boolean
    saveToDb: boolean
  }

  const cleanUrls = urls.map((u: string) => u.trim()).filter(Boolean).slice(0, 20)
  if (!cleanUrls.length) {
    return new Response(JSON.stringify({ error: 'No URLs provided' }), { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data:${JSON.stringify(data)}\n`))

      const supabase = saveToDb
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
        : null

      const seen = new Set<string>()
      let total = 0

      try {
        for (const url of cleanUrls) {
          const found = await scrapeUrl(url, false, deepCrawl, seen, send, saveToDb, supabase)
          total += found
        }
        send({ type: 'done', total })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
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
