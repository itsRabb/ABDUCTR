import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getActiveProxy, isProxyEnabled } from '@/lib/proxy-manager'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)] }

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
]
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
]

// ─── Proxy ───────────────────────────────────────────────────────────────────
interface ProxyConfig { host: string; port: number }
function proxyArgs(proxy?: ProxyConfig | null): string[] {
  return proxy ? [`--proxy-server=${proxy.host}:${proxy.port}`] : []
}

// ─── Email extraction ─────────────────────────────────────────────────────────
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

function extractEmails(text: string): string[] {
  const deob = text
    .replace(/\[\s*at\s*\]/gi, '@').replace(/\(\s*at\s*\)/gi, '@')
    .replace(/\s+at\s+(?=[a-zA-Z0-9])/gi, '@')
    .replace(/\[\s*dot\s*\]/gi, '.').replace(/&#64;/g, '@')
    .replace(/&#46;/g, '.').replace(/\\u0040/g, '@').replace(/\\u002e/gi, '.')
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

// ─── Worker 2: Website fetcher ────────────────────────────────────────────────
const DEEP_PATHS = [
  '/contact', '/contact-us', '/about', '/about-us', '/team', '/our-team',
  '/staff', '/agents', '/realtors', '/directory', '/people', '/meet-the-team',
  '/leadership', '/founders', '/management', '/associates', '/partners',
]

async function fetchHtml(url: string, proxy?: ProxyConfig | null, retryPuppeteer = true): Promise<{ html: string; usedPuppeteer: boolean }> {
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 12000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': pick(USER_AGENTS), 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8' },
      redirect: 'follow',
    })
    const html = await res.text()
    // If page looks empty or JS-rendered, fall back to Puppeteer
    if (retryPuppeteer && (html.length < 3000 || (!html.includes('@') && !html.includes('contact')))) {
      return fetchHtmlPuppeteer(url, proxy)
    }
    return { html, usedPuppeteer: false }
  } catch {
    if (retryPuppeteer) return fetchHtmlPuppeteer(url, proxy)
    return { html: '', usedPuppeteer: false }
  }
}

async function fetchHtmlPuppeteer(url: string, proxy?: ProxyConfig | null): Promise<{ html: string; usedPuppeteer: boolean }> {
  let browser
  try {
    const puppeteer = await import('puppeteer')
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', ...proxyArgs(proxy)],
    })
    const page = await browser.newPage()
    await page.setViewport(pick(VIEWPORTS))
    await page.setUserAgent(pick(USER_AGENTS))
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await delay(1200)
    const html = await page.content()
    return { html, usedPuppeteer: true }
  } catch {
    return { html: '', usedPuppeteer: true }
  } finally {
    await browser?.close().catch(() => null)
  }
}

// ─── Worker 3: Email extractor ────────────────────────────────────────────────
interface ExtractedEmail {
  email: string
  source: 'mailto' | 'regex' | 'deep_crawl'
  confidence: 'high' | 'medium' | 'low'
  source_url: string
}

interface SiteSignals {
  // Social
  instagram?: string
  facebook?: string
  linkedin_url?: string
  // Tech stack
  cms?: string
  analytics_present?: boolean
  // Page features
  has_contact_form?: boolean
  has_blog?: boolean
  has_email_signup?: boolean
  // Contact (heuristic from team/staff pages)
  contact_name?: string
  role?: string
}

async function extractEmailsFromSite(
  website: string,
  deepCrawl: boolean,
  send: (d: object) => void,
  proxy?: ProxyConfig | null,
  leadName?: string
): Promise<{ emails: ExtractedEmail[]; signals: SiteSignals }> {
  const baseUrl = website.startsWith('http') ? website : `https://${website}`
  const allEmails: ExtractedEmail[] = []
  const seen = new Set<string>()
  const signals: SiteSignals = {}

  const processPage = async (url: string, source: 'mailto' | 'regex' | 'deep_crawl') => {
    send({ type: 'worker2', data: { url, status: 'fetching' } })
    const { html } = await fetchHtml(url, proxy)
    if (!html) return

    send({ type: 'worker2', data: { url, status: 'fetched', chars: html.length } })

    // ── High confidence: mailto links ──────────────────────────────────────
    const mailtoRx = /<a[^>]+href=["']mailto:([^"'?# ]+)[^>]*>/gi
    let m
    while ((m = mailtoRx.exec(html)) !== null) {
      const email = m[1].trim().toLowerCase()
      if (email.includes('@') && !seen.has(email)) {
        seen.add(email)
        allEmails.push({ email, source: 'mailto', confidence: 'high', source_url: url })
        send({ type: 'worker3', data: { email, source: 'mailto', confidence: 'high', source_url: url, company: leadName } })
      }
    }

    // ── Medium confidence: regex sweep ─────────────────────────────────────
    const raw = extractEmails(html)
    for (const email of raw) {
      if (!seen.has(email)) {
        seen.add(email)
        const s: ExtractedEmail = { email, source, confidence: source === 'deep_crawl' ? 'medium' : 'medium', source_url: url }
        allEmails.push(s)
        send({ type: 'worker3', data: { email, source, confidence: s.confidence, source_url: url, company: leadName } })
      }
    }

    // ── Social links ───────────────────────────────────────────────────────
    const socialRx = /https?:\/\/(?:www\.)?(instagram\.com|facebook\.com|linkedin\.com|twitter\.com|x\.com)\/[^\s"'<>?#]+/gi
    let sm
    while ((sm = socialRx.exec(html)) !== null) {
      const link = sm[0].split('"')[0].split("'")[0] // trim trailing cruft
      const host = sm[1]
      if (host.includes('instagram') && !signals.instagram) signals.instagram = link
      if (host.includes('facebook') && !signals.facebook) signals.facebook = link
      if (host.includes('linkedin') && !signals.linkedin_url) signals.linkedin_url = link
    }

    // ── Analytics detection ────────────────────────────────────────────────
    if (!signals.analytics_present) {
      signals.analytics_present =
        html.includes('googletagmanager.com') ||
        html.includes('google-analytics.com') ||
        html.includes('gtag(') ||
        html.includes('fbevents.js') ||
        html.includes('segment.analytics') ||
        html.includes('hotjar.com')
    }

    // ── CMS detection ──────────────────────────────────────────────────────
    if (!signals.cms) {
      if (html.includes('wp-content') || html.includes('wp-includes')) signals.cms = 'WordPress'
      else if (html.includes('squarespace.com') || html.includes('static1.squarespace')) signals.cms = 'Squarespace'
      else if (html.includes('wix.com') || html.includes('wixstatic.com')) signals.cms = 'Wix'
      else if (html.includes('cdn.shopify.com')) signals.cms = 'Shopify'
      else if (html.includes('webflow.io') || html.includes('.webflow.com')) signals.cms = 'Webflow'
      else if (html.includes('godaddy.com/static') || html.includes('secureserver.net')) signals.cms = 'GoDaddy'
      else if (html.includes('sites.google.com') || html.includes('googleusercontent.com/sites')) signals.cms = 'Google Sites'
      else {
        const genMatch = html.match(/<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i)
        if (genMatch) signals.cms = genMatch[1].split(/[ /]/)[0]
      }
    }

    // ── Page feature signals ───────────────────────────────────────────────
    if (!signals.has_contact_form && (url.includes('/contact') || url.includes('/about'))) {
      signals.has_contact_form = /<form[\s>]/i.test(html)
    }
    if (!signals.has_blog) {
      signals.has_blog = /href=["'][^"']*\/blog[/"']/i.test(html) || html.includes('/blog/')
    }
    if (!signals.has_email_signup) {
      signals.has_email_signup =
        /<input[^>]+type=["']?email["']?/i.test(html) &&
        /subscri|newsletter|signup|sign.up/i.test(html)
    }

    // ── Contact name + role (heuristic from team/staff/about pages) ────────
    if (!signals.contact_name && (
      url.includes('/team') || url.includes('/staff') || url.includes('/agents') ||
      url.includes('/about') || url.includes('/people') || url.includes('/directory')
    )) {
      // schema.org Person microdata
      const schemaName = html.match(/itemprop=["']name["'][^>]*>([A-Z][a-z]+(?: [A-Z][a-z]+)+)</i)
      if (schemaName) {
        signals.contact_name = schemaName[1].trim()
        // look for role nearby
        const roleMatch = html.match(/itemprop=["'](?:jobTitle|title)["'][^>]*>([^<]{3,60})</i)
        if (roleMatch) signals.role = roleMatch[1].trim()
      }

      // Common layout: <h2/h3>Full Name</h2/h3> then <p>Title</p>
      if (!signals.contact_name) {
        const TITLE_KW = /\b(owner|founder|ceo|coo|cto|president|director|manager|agent|broker|partner|principal|realtor|associate|consultant|advisor)\b/i
        const nameBlock = html.match(
          /<(?:h[234]|strong|b)[^>]*>\s*([A-Z][a-z]{1,20}(?: [A-Z][a-z]{1,20}){1,3})\s*<\/(?:h[234]|strong|b)>\s*(?:<[^>]+>\s*)*([^<]{3,80})<\//i
        )
        if (nameBlock && TITLE_KW.test(nameBlock[2])) {
          signals.contact_name = nameBlock[1].trim()
          signals.role = nameBlock[2].replace(/&amp;/g, '&').trim()
        }
      }
    }
  }

  // Main page
  await processPage(baseUrl, 'regex')

  // Deep crawl contact/team pages
  if (deepCrawl && allEmails.length < 3) {
    const origin = new URL(baseUrl).origin
    for (const path of DEEP_PATHS) {
      const pageUrl = `${origin}${path}`
      try {
        const ctrl = new AbortController()
        setTimeout(() => ctrl.abort(), 5000)
        const probe = await fetch(pageUrl, { signal: ctrl.signal, redirect: 'follow' })
        if (probe.ok) await processPage(pageUrl, 'deep_crawl')
      } catch { /* skip */ }
      if (allEmails.length >= 5) break
    }
  }

  return { emails: allEmails, signals }
}

// ─── City/state parser ───────────────────────────────────────────────────────
function parseAddress(address: string): { city: string; state: string } {
  // Format: "123 Street, City, ST ZIP" — city is second-to-last, state is last
  const parts = address.split(',').map(s => s.trim())
  if (parts.length >= 2) {
    const city = parts[parts.length - 2] || ''
    const stateZip = parts[parts.length - 1] || ''
    const state = stateZip.split(' ')[0] || ''
    return { city, state }
  }
  return { city: '', state: '' }
}

// ─── Worker 1: Google Maps scraper ───────────────────────────────────────────
interface MapsLead {
  company_name: string
  phone?: string
  website?: string
  address_full?: string
  city?: string
  state?: string
  business_type?: string
  rating?: number
  review_count?: number
  hours?: string
}

async function scrapeGoogleMaps(
  query: string, maxResults: number,
  send: (d: object) => void,
  proxy?: ProxyConfig | null
): Promise<MapsLead[]> {
  const leads: MapsLead[] = []
  let browser
  try {
    const puppeteer = await import('puppeteer')
    browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--disable-gpu', '--disable-blink-features=AutomationControlled',
        ...proxyArgs(proxy),
      ],
    })

    const page = await browser.newPage()
    await page.setViewport(pick(VIEWPORTS))
    await page.setUserAgent(pick(USER_AGENTS))
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).chrome = { runtime: {} }
    })

    const encoded = encodeURIComponent(query)
    send({ type: 'status', stage: 1, message: `Worker 1: opening Google Maps for "${query}"...` })
    await page.goto(`https://www.google.com/maps/search/${encoded}`, {
      waitUntil: 'networkidle2', timeout: 30000,
    })

    // Block detection
    const url = page.url()
    if (url.includes('/sorry/')) {
      send({ type: 'warning', message: 'Worker 1: Google bot detection triggered – skipping' })
      return leads
    }

    await page.waitForSelector('[role="article"]', { timeout: 12000 }).catch(() => null)
    await delay(randInt(1500, 2500))

    const seen = new Set<string>()       // by business name
    const seenSites = new Set<string>()  // by normalized hostname — prevents duplicate sponsored+organic entries
    for (let scroll = 0; scroll < 15 && leads.length < maxResults; scroll++) {
      const listings = await page.$$('[role="article"]')
      for (const listing of listings) {
        if (leads.length >= maxResults) break
        try {
          const nameEl = await listing.$('[aria-label]')
          const name = nameEl ? await nameEl.evaluate(el => el.getAttribute('aria-label') || '') : ''
          if (!name || seen.has(name)) continue
          seen.add(name)

          await listing.click()
          await delay(randInt(600, 1200))

          const details = await page.evaluate(() => {
            // Phone
            const phoneEl =
              document.querySelector('[data-tooltip="Copy phone number"]') ||
              document.querySelector('button[aria-label*="phone"]') ||
              document.querySelector('[data-item-id*="phone"]')
            const phone = phoneEl?.textContent?.trim().replace(/[^\d\s()\-+]/g, '').trim() || ''

            // Website
            const websiteEl =
              document.querySelector('a[data-tooltip="Open website"]') ||
              document.querySelector('a[aria-label*="website"]') ||
              document.querySelector('a[data-item-id="authority"]')
            const website = websiteEl?.getAttribute('href') || ''

            // Address
            const addrEl =
              document.querySelector('button[data-tooltip="Copy address"]') ||
              document.querySelector('button[aria-label*="Address"]') ||
              document.querySelector('[data-item-id*="address"]')
            const address = addrEl?.textContent?.trim() || ''

            // Category / business type
            const categoryEl =
              document.querySelector('[jsaction*="category"]') ||
              document.querySelector('.DkEaL') ||
              document.querySelector('.fontBodyMedium span:first-child')
            const category = categoryEl?.textContent?.trim() || ''

            // Rating
            const ratingEl =
              document.querySelector('[aria-label*="stars"]') ||
              document.querySelector('.MW4etd')
            const ratingText = ratingEl?.getAttribute('aria-label') || ratingEl?.textContent || ''
            const ratingMatch = ratingText.match(/(\d+\.?\d*)/)
            const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0

            // Review count
            const reviewEl =
              document.querySelector('.UY7F9') ||
              document.querySelector('[aria-label*="review"]')
            const reviewText = reviewEl?.textContent || reviewEl?.getAttribute('aria-label') || ''
            const reviewMatch = reviewText.replace(/,/g, '').match(/(\d+)/)
            const review_count = reviewMatch ? parseInt(reviewMatch[1]) : 0

            // Hours
            const hoursEl =
              document.querySelector('[aria-label*="hour"]') ||
              document.querySelector('.t39EBf')
            let hours = hoursEl?.getAttribute('aria-label') || hoursEl?.textContent?.trim() || ''
            if (hours.length > 120) hours = hours.substring(0, 120)

            return { phone, website, address, category, rating, review_count, hours }
          })

          // Parse city & state from full address
          const { city: parsedCity, state: parsedState } = details.address
            ? parseAddress(details.address)
            : { city: '', state: '' }

          // Filter Google Ads redirect URLs (/aclk?...) — these are not real websites
          const rawWebsite = details.website || ''
          const isAdUrl = rawWebsite.startsWith('/aclk') || rawWebsite.includes('google.com/aclk')
          const cleanWebsite = isAdUrl ? '' : rawWebsite

          // Deduplicate by normalized hostname
          let siteKey = ''
          if (cleanWebsite) {
            try {
              const u = new URL(cleanWebsite.startsWith('http') ? cleanWebsite : `https://${cleanWebsite}`)
              siteKey = u.hostname.replace(/^www\./, '')
            } catch { siteKey = cleanWebsite }
          }
          if (siteKey && seenSites.has(siteKey)) continue
          if (siteKey) seenSites.add(siteKey)

          const lead: MapsLead = {
            company_name: name,
            phone: details.phone || undefined,
            website: cleanWebsite || undefined,
            address_full: details.address || undefined,
            city: parsedCity || undefined,
            state: parsedState || undefined,
            business_type: details.category || undefined,
            rating: details.rating || undefined,
            review_count: details.review_count || undefined,
            hours: details.hours || undefined,
          }
          leads.push(lead)
          send({ type: 'worker1', data: lead })
        } catch { /* skip card */ }
      }

      // Scroll results panel
      await page.evaluate(() => {
        const panel = document.querySelector('[role="feed"]') as HTMLElement
        if (panel) panel.scrollTop += 800
      })
      await delay(randInt(800, 1500))
    }
  } catch (err) {
    send({ type: 'error', message: `Worker 1 error: ${err instanceof Error ? err.message : 'Unknown'}` })
  } finally {
    await browser?.close().catch(() => null)
  }
  return leads
}

// ─── POST handler (pipeline orchestrator) ────────────────────────────────────
export async function POST(req: NextRequest) {
  const { query, city, maxLeads = 20, autoSave = false, deepCrawl = true } = await req.json()

  if (!query || !city) {
    return new Response(JSON.stringify({ error: 'query and city required' }), { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`))
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase: any = autoSave && process.env.NEXT_PUBLIC_SUPABASE_URL
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any)
        : null

      // ── Proxy check ─────────────────────────────────────────────────────
      let activeProxy: ProxyConfig | null = null
      const proxyOn = await isProxyEnabled()
      if (proxyOn) {
        activeProxy = await getActiveProxy()
        if (activeProxy) {
          send({ type: 'status', message: `Proxy Shield active: ${activeProxy.host}:${activeProxy.port}` })
        } else {
          send({ type: 'status', message: 'Proxy Shield enabled but no proxies loaded — scraping direct' })
        }
      }

      const stats = { leads: 0, websites: 0, emails: 0 }

      // ── Job record ────
      let jobId: string | null = null
      if (supabase) {
        const { data } = await supabase.from('scrape_jobs').insert({
          query, city, status: 'running', started_at: new Date().toISOString(),
        }).select('id').single()
        jobId = data?.id ?? null
      }

      try {
        // ── Worker 1: Google Maps ────────────────────────────────────────────
        send({ type: 'status', stage: 1, message: `Worker 1: Scanning Google Maps for "${query}" in ${city}...` })
        const searchQuery = `${query} ${city}`
        const mapsLeads = await scrapeGoogleMaps(searchQuery, maxLeads, send, activeProxy)
        stats.leads = mapsLeads.length
        send({ type: 'stats', data: { ...stats } })
        send({ type: 'status', stage: 1, message: `Worker 1: Found ${mapsLeads.length} businesses ✓` })

        // ── Workers 2+3: Per-lead website fetch + email extract ───────────────
        for (const lead of mapsLeads) {
          // One UUID per Maps listing — shared across all contact rows for this company
          const companyId = crypto.randomUUID()

          if (!lead.website) {
            // Save lead with no email still (for the DB)
            if (supabase) {
              try {
                const { data: savedLead } = await supabase.from('leads').insert({
                  company_id:    companyId,
                  company_name:  lead.company_name,
                  phone:         lead.phone ?? null,
                  website:       null,
                  city:          lead.city ?? city,
                  state:         lead.state ?? null,
                  business_type: lead.business_type ?? null,
                  rating:        lead.rating ?? null,
                  review_count:  lead.review_count ?? null,
                  address_full:  lead.address_full ?? null,
                  hours:         lead.hours ?? null,
                }).select('id').single()
                if (savedLead?.id) {
                  send({ type: 'saved', data: { lead_id: savedLead.id, lead_name: lead.company_name, email_count: 0 } })
                }
              } catch (dbErr) {
                send({ type: 'warning', message: `DB save failed for "${lead.company_name}": ${dbErr instanceof Error ? dbErr.message : 'unknown'}` })
              }
            }
            continue
          }

          stats.websites++
          send({ type: 'status', stage: 2, message: `Worker 2: Fetching ${lead.website}...` })

          const { emails, signals } = await extractEmailsFromSite(lead.website, deepCrawl, send, activeProxy, lead.company_name)
          stats.emails += emails.length
          send({ type: 'stats', data: { ...stats } })

          // Save to DB — one row per email (each email is its own lead record)
          if (supabase) {
            try {
              // Base company fields shared across all rows for this lead
              const baseRow = {
                company_id:     companyId,
                company_name:   lead.company_name,
                phone:          lead.phone          ?? null,
                website:        lead.website        ?? null,
                city:           lead.city           ?? city,
                state:          lead.state          ?? null,
                business_type:  lead.business_type  ?? null,
                rating:         lead.rating         ?? null,
                review_count:   lead.review_count   ?? null,
                address_full:   lead.address_full   ?? null,
                hours:          lead.hours          ?? null,
                contact_name:   signals.contact_name ?? null,
                role:           signals.role         ?? null,
                instagram:      signals.instagram    ?? null,
                facebook:       signals.facebook     ?? null,
                linkedin_url:   signals.linkedin_url ?? null,
                cms:            signals.cms          ?? null,
                analytics_present: signals.analytics_present ?? null,
                has_contact_form:  signals.has_contact_form  ?? null,
                has_blog:          signals.has_blog          ?? null,
                has_email_signup:  signals.has_email_signup  ?? null,
              }

              if (emails.length === 0) {
                // No emails found — save one placeholder row so the company isn't lost
                const { data: saved } = await supabase.from('leads').insert(baseRow).select('id').single()
                if (saved?.id) send({ type: 'saved', data: { lead_id: saved.id, lead_name: lead.company_name, email_count: 0 } })
              } else {
                // One row per email — each contact gets its own UUID + full company context
                const rows = emails.map(e => ({
                  ...baseRow,
                  email:            e.email,
                  email_confidence: e.confidence,
                  email_source:     e.source,
                }))
                const { data: saved } = await supabase.from('leads').insert(rows).select('id')
                const count = saved?.length ?? 0
                if (count > 0) send({ type: 'saved', data: { lead_name: lead.company_name, email_count: count } })
              }
            } catch (dbErr) {
              send({ type: 'warning', message: `DB save failed for "${lead.company_name}": ${dbErr instanceof Error ? dbErr.message : 'unknown'}` })
            }
          } else {
            // No DB — just signal found
            send({ type: 'found', data: { lead, emails: emails.map(e => e.email), signals } })
          }

          // Rate limiting between sites
          await delay(randInt(500, 1200))
        }

        // ── Update job record ────
        if (supabase && jobId) {
          await supabase.from('scrape_jobs').update({
            status: 'done',
            leads_found: stats.leads,
            websites_fetched: stats.websites,
            emails_found: stats.emails,
            finished_at: new Date().toISOString(),
          }).eq('id', jobId)
        }

        send({
          type: 'done',
          data: { total_leads: stats.leads, total_emails: stats.emails, job_id: jobId },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Pipeline error'
        send({ type: 'error', message: msg })
        if (supabase && jobId) {
          await supabase.from('scrape_jobs').update({ status: 'failed', error_msg: msg }).eq('id', jobId)
        }
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
