import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ScrapeFieldGroup } from '@/lib/types'
import { getActiveProxy, isProxyEnabled } from '@/lib/proxy-manager'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─── User-agent + viewport rotation ─────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]
const VIEWPORTS = [
  { width: 1920, height: 1080 }, { width: 1440, height: 900 },
  { width: 1366, height: 768 },  { width: 1280, height: 800 },
]
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)] }
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// â”€â”€â”€ Browser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ProxyConfig { host: string; port: number }

async function getBrowser(proxy?: ProxyConfig | null) {
  const proxyArgs = proxy ? [`--proxy-server=${proxy.host}:${proxy.port}`] : []
  const commonArgs = [
    ...proxyArgs,
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--no-zygote',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars', '--window-size=1920,1080',
  ]
  try {
    const puppeteer = await import('puppeteer')
    return await puppeteer.default.launch({ headless: true, args: commonArgs })
  } catch {
    try {
      const puppeteer = await import('puppeteer')
      return await puppeteer.default.launch({ headless: true, args: commonArgs })
    } catch {
      const chromium = await import('@sparticuz/chromium-min')
      const puppeteerCore = await import('puppeteer-core')
      return await puppeteerCore.default.launch({
        args: [...chromium.default.args, ...proxyArgs],
        executablePath: await chromium.default.executablePath(
          'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
        ),
        headless: true,
      })
    }
  }
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ScrapedLead {
  company_name: string
  phone?: string
  website?: string
  city?: string
  state?: string
  business_type?: string
  // Google extra
  rating?: number
  review_count?: number
  address_full?: string
  hours?: string
  location_count?: string
  // Email (direct scrape)
  email?: string
  // Social
  instagram?: string
  facebook?: string
  linkedin_url?: string
  // Tech stack
  cms?: string
  hosting?: string
  email_provider?: string
  // Marketing
  has_contact_form?: boolean
  has_blog?: boolean
  has_email_signup?: boolean
}

// â”€â”€â”€ Website enrichment (uses fetch, no Puppeteer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ─── Email extraction helpers ────────────────────────────────────────────────
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

function extractEmails(text: string): string[] {
  // De-obfuscate common patterns before regex
  const deob = text
    .replace(/\[\s*at\s*\]/gi, '@')
    .replace(/\s+at\s+(?=[a-zA-Z0-9])/gi, '@')
    .replace(/\[\s*dot\s*\]/gi, '.')
    .replace(/&#64;/g, '@')
    .replace(/&#46;/g, '.')
    .replace(/&amp;/g, '&')
  const found = deob.match(EMAIL_REGEX) || []
  // Filter out false positives (image filenames, CSS, etc.)
  return [...new Set(found.filter(e =>
    !e.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|ttf|webp)$/i) &&
    !e.startsWith('noreply@') &&
    !e.includes('example.com') &&
    !e.includes('sentry.io') &&
    !e.includes('@2x')
  ))]
}

async function enrichFromWebsite(
  website: string,
  fields: ScrapeFieldGroup[]
): Promise<Partial<ScrapedLead>> {
  const result: Partial<ScrapedLead> = {}
  if (!fields.some(f => ['social', 'tech_stack', 'marketing', 'email'].includes(f))) return result

  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)

    const html = await res.text()
    const serverHeader = res.headers.get('server') || ''
    const poweredBy = res.headers.get('x-powered-by') || ''

    // ── Email extraction ──────────────────────────────────────────────────────
    if (fields.includes('email')) {
      // 1. mailto: links (most reliable)
      const mailtoMatches = [...html.matchAll(/href="mailto:([^"?]+)/gi)]
      const mailtoEmails = mailtoMatches.map(m => m[1].trim().toLowerCase())
      // 2. Raw email regex across full HTML
      const rawEmails = extractEmails(html)
      const allEmails = [...new Set([...mailtoEmails, ...rawEmails])]
      if (allEmails.length > 0) result.email = allEmails[0]
    }

    // â”€â”€ Social links â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (fields.includes('social')) {
      const igMatch = html.match(/instagram\.com\/([A-Za-z0-9_.]+)/i)
      if (igMatch) result.instagram = `https://instagram.com/${igMatch[1]}`

      const fbMatch = html.match(/facebook\.com\/([A-Za-z0-9_./-]+)/i)
      if (fbMatch) {
        const slug = fbMatch[1].replace(/\/$/, '')
        if (!['sharer', 'share', 'dialog', 'plugins'].includes(slug.split('/')[0])) {
          result.facebook = `https://facebook.com/${slug}`
        }
      }

      const liMatch = html.match(/linkedin\.com\/(company|in)\/([A-Za-z0-9_-]+)/i)
      if (liMatch) result.linkedin_url = `https://linkedin.com/${liMatch[1]}/${liMatch[2]}`
    }

    // â”€â”€ Tech stack â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (fields.includes('tech_stack')) {
      if (html.includes('wp-content') || html.includes('wp-includes') || html.includes('wp-json')) {
        result.cms = 'WordPress'
      } else if (html.includes('cdn.shopify.com')) {
        result.cms = 'Shopify'
      } else if (html.includes('static.wixstatic.com')) {
        result.cms = 'Wix'
      } else if (html.includes('squarespace.com')) {
        result.cms = 'Squarespace'
      } else if (html.includes('webflow.com') || html.includes('Webflow')) {
        result.cms = 'Webflow'
      } else if (html.includes('godaddy')) {
        result.cms = 'GoDaddy'
      }

      if (serverHeader.toLowerCase().includes('cloudflare')) result.hosting = 'Cloudflare'
      else if (res.headers.get('x-vercel-id')) result.hosting = 'Vercel'
      else if (res.headers.get('x-amz-request-id') || res.headers.get('x-amz-cf-id')) result.hosting = 'AWS'
      else if (poweredBy.includes('WP Engine')) result.hosting = 'WP Engine'
      else if (serverHeader.toLowerCase().includes('nginx')) result.hosting = 'Nginx'
      else if (serverHeader.toLowerCase().includes('apache')) result.hosting = 'Apache'
      else if (serverHeader) result.hosting = serverHeader.split('/')[0]

      // Email provider via DNS MX
      try {
        const hostname = new URL(url).hostname.replace(/^www\./, '')
        const dnsRes = await fetch(
          `https://dns.google/resolve?name=${hostname}&type=MX`,
          { signal: AbortSignal.timeout(3000) }
        )
        const dns = await dnsRes.json()
        const mx: string = (dns?.Answer?.[0]?.data || '').toLowerCase()
        if (mx.includes('google') || mx.includes('aspmx')) result.email_provider = 'Google Workspace'
        else if (mx.includes('outlook') || mx.includes('office365') || mx.includes('microsoft')) result.email_provider = 'Microsoft 365'
        else if (mx.includes('zoho')) result.email_provider = 'Zoho Mail'
        else if (mx.includes('mailgun')) result.email_provider = 'Mailgun'
        else if (mx.includes('sendgrid')) result.email_provider = 'SendGrid'
        else if (mx) result.email_provider = mx.split(' ').pop()?.replace(/\.$/, '') || undefined
      } catch { /* DNS optional */ }
    }

    // â”€â”€ Marketing signals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (fields.includes('marketing')) {
      const lower = html.toLowerCase()
      result.has_contact_form =
        lower.includes('<form') &&
        (lower.includes('contact') || lower.includes('message') || lower.includes('inquiry'))
      result.has_blog =
        lower.includes('/blog') || lower.includes('/news') || lower.includes('/articles') ||
        lower.includes('class="post') || lower.includes('class="blog')
      result.has_email_signup =
        (lower.includes('subscribe') || lower.includes('newsletter') || lower.includes('email signup')) &&
        lower.includes('input')
    }
  } catch { /* enrichment is best-effort */ }

  return result
}

// ─── Google Maps scraper ─────────────────────────────────────────────────────

async function isBlocked(page: import('puppeteer').Page): Promise<boolean> {
  const url = page.url()
  if (url.includes('/sorry/') || url.includes('google.com/sorry')) return true
  const content = await page.content()
  if (
    content.includes('unusual traffic') ||
    content.includes('CAPTCHA') ||
    content.includes('g-recaptcha')
  ) return true
  return false
}

async function scrapeGoogleMaps(
  query: string,
  maxResults: number,
  fields: ScrapeFieldGroup[],
  onLead: (lead: ScrapedLead) => Promise<void>,
  onStatus: (msg: string) => void,
  proxy?: ProxyConfig | null
): Promise<{ count: number; blocked: boolean }> {
  let browser
  let count = 0
  try {
    browser = await getBrowser(proxy)
    const viewport = pick(VIEWPORTS)
    const ua = pick(USER_AGENTS)
    const page = await browser.newPage()
    await page.setViewport(viewport)
    await page.setUserAgent(ua)

    // Extra stealth: mask navigator fingerprints before any page load
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).chrome = { runtime: {} }
    })

    const encodedQuery = encodeURIComponent(query)
    await page.goto(`https://www.google.com/maps/search/${encodedQuery}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    if (await isBlocked(page)) {
      await browser.close().catch(() => null)
      return { count: 0, blocked: true }
    }

    await page.waitForSelector('[role="article"]', { timeout: 12000 }).catch(() => null)
    await delay(randInt(1500, 3000))

    if (await isBlocked(page)) {
      await browser.close().catch(() => null)
      return { count: 0, blocked: true }
    }

    const seen = new Set<string>()       // by name
    const seenSites = new Set<string>()  // by hostname — skip duplicate sponsored+organic entries
    const wantExtra = fields.includes('google_extra')
    let noNewLeadsStreak = 0

    for (let scroll = 0; scroll < 20 && count < maxResults; scroll++) {
      const listings = await page.$$('[role="article"]')
      let newThisRound = 0

      for (const listing of listings) {
        if (count >= maxResults) break

        try {
          const nameEl = await listing.$('[aria-label]')
          const name = nameEl ? await nameEl.evaluate(el => el.getAttribute('aria-label') || '') : ''
          if (!name || seen.has(name)) continue
          seen.add(name)
          newThisRound++

          await listing.click()
          await delay(randInt(800, 1600))

          const details = await page.evaluate((grabExtra: boolean) => {
            const phoneEl =
              document.querySelector('[data-tooltip="Copy phone number"]') ||
              document.querySelector('button[aria-label*="phone"]') ||
              document.querySelector('[data-item-id*="phone"]')
            const phone = phoneEl?.textContent?.trim().replace(/[^\d\s()\-+]/g, '').trim() || ''

            const websiteEl =
              document.querySelector('a[data-tooltip="Open website"]') ||
              document.querySelector('a[aria-label*="website"]')
            const website = websiteEl?.getAttribute('href') || ''

            const addressEl =
              document.querySelector('button[data-tooltip="Copy address"]') ||
              document.querySelector('[data-item-id*="address"]')
            const address = addressEl?.textContent?.trim() || ''

            const categoryEl =
              document.querySelector('[jsaction*="category"]') ||
              document.querySelector('.DkEaL')
            const category = categoryEl?.textContent?.trim() || ''

            let rating = 0, review_count = 0, hours = ''

            if (grabExtra) {
              const ratingEl = document.querySelector('[aria-label*="stars"]') ||
                               document.querySelector('.MW4etd')
              const ratingText = ratingEl?.getAttribute('aria-label') || ratingEl?.textContent || ''
              const ratingMatch = ratingText.match(/(\d+\.?\d*)/)
              if (ratingMatch) rating = parseFloat(ratingMatch[1])

              const reviewEl = document.querySelector('.UY7F9') ||
                               document.querySelector('[aria-label*="review"]')
              const reviewText = reviewEl?.textContent || reviewEl?.getAttribute('aria-label') || ''
              const reviewMatch = reviewText.replace(/,/g, '').match(/(\d+)/)
              if (reviewMatch) review_count = parseInt(reviewMatch[1])

              const hoursEl = document.querySelector('[aria-label*="hour"]') ||
                              document.querySelector('.t39EBf')
              hours = hoursEl?.getAttribute('aria-label') || hoursEl?.textContent?.trim() || ''
              if (hours.length > 120) hours = hours.substring(0, 120)
            }

            return { phone, website, address, category, rating, review_count, hours }
          }, wantExtra)

          let city = '', state = ''
          if (details.address) {
            // Format: "Street, City, ST ZIP" or "Street, Suite, City, ST ZIP"
            // city is always second-to-last segment, state+zip is last
            const parts = details.address.split(',').map((s: string) => s.trim())
            if (parts.length >= 2) {
              city = parts[parts.length - 2] || ''
              const stateZip = parts[parts.length - 1] || ''
              state = stateZip.split(' ')[0] || ''
            }
          }

          // Filter Google Ads redirect URLs and deduplicate by hostname
          const rawWebsite = details.website || ''
          const isAdUrl = rawWebsite.startsWith('/aclk') || rawWebsite.includes('google.com/aclk')
          const cleanWebsite = isAdUrl ? '' : rawWebsite
          if (cleanWebsite) {
            let siteKey = cleanWebsite
            try {
              const u = new URL(cleanWebsite.startsWith('http') ? cleanWebsite : `https://${cleanWebsite}`)
              siteKey = u.hostname.replace(/^www\./, '')
            } catch { /* use raw */ }
            if (seenSites.has(siteKey)) continue
            seenSites.add(siteKey)
          }

          const lead: ScrapedLead = {
            company_name: name,
            phone: details.phone || undefined,
            website: cleanWebsite || undefined,
            city: city || undefined,
            state: state || undefined,
            business_type: details.category || undefined,
          }

          if (wantExtra) {
            if (details.rating) lead.rating = details.rating
            if (details.review_count) lead.review_count = details.review_count
            if (details.address) lead.address_full = details.address
            if (details.hours) lead.hours = details.hours
          }

          if (cleanWebsite) {
            onStatus(`Analyzing ${name}...`)
            const enriched = await enrichFromWebsite(cleanWebsite, fields)
            Object.assign(lead, enriched)
          }

          await onLead(lead)
          count++
        } catch { /* skip */ }
      }

      if (newThisRound === 0) {
        noNewLeadsStreak++
        if (noNewLeadsStreak >= 3) break
      } else {
        noNewLeadsStreak = 0
      }

      if (count < maxResults) {
        await page.evaluate(() => {
          const panel = document.querySelector('[role="main"]') || document.querySelector('.m6QErb')
          if (panel) panel.scrollTop += 1200
        })
        await delay(randInt(1200, 2500))
      }
    }

    return { count, blocked: false }
  } finally {
    if (browser) await browser.close().catch(() => null)
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 3

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { query, maxResults = 20, fields = [] } = body

  if (!query?.trim()) {
    return new Response(JSON.stringify({ error: 'Query is required' }), { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data:${JSON.stringify(data)}\n`))
      }

      let totalCount = 0

      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        send({ type: 'status', message: 'Warming up tractor beam...' })

        // ── Proxy check ──────────────────────────────────────────────────
        let activeProxy: ProxyConfig | null = null
        const proxyOn = await isProxyEnabled()
        if (proxyOn) {
          activeProxy = await getActiveProxy()
          if (activeProxy) {
            send({ type: 'status', message: `Proxy active: ${activeProxy.host}:${activeProxy.port}` })
          } else {
            send({ type: 'status', message: 'Proxy enabled but no proxies loaded — scraping direct' })
          }
        }

        // ── Retry loop ───────────────────────────────────────────────────
        let result = { count: 0, blocked: false }

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (attempt > 1) {
            const backoff = 3000 * attempt
            send({ type: 'status', message: `Retry ${attempt}/${MAX_RETRIES} in ${backoff / 1000}s...` })
            await delay(backoff)

            if (result.blocked && proxyOn) {
              activeProxy = await getActiveProxy()
              if (activeProxy) {
                send({ type: 'status', message: `Switched proxy: ${activeProxy.host}:${activeProxy.port}` })
              }
            }
          }

          result = await scrapeGoogleMaps(
            query,
            Math.min(maxResults, 50),
            fields,
            async (item) => {
              try {
                // ── Duplicate check ──────────────────────────────────────
                const { count } = await supabase
                  .from('leads')
                  .select('id', { count: 'exact', head: true })
                  .ilike('company_name', item.company_name)
                if (count && count > 0) {
                  send({ type: 'duplicate', name: item.company_name })
                  return
                }

                const { data, error } = await supabase
                  .from('leads')
                  .insert({
                    company_name: item.company_name,
                    phone: item.phone ?? null,
                    website: item.website ?? null,
                    city: item.city ?? null,
                    state: item.state ?? null,
                    business_type: item.business_type ?? null,
                    rating: item.rating ?? null,
                    review_count: item.review_count ?? null,
                    address_full: item.address_full ?? null,
                    hours: item.hours ?? null,
                    location_count: item.location_count ?? null,
                    instagram: item.instagram ?? null,
                    facebook: item.facebook ?? null,
                    linkedin_url: item.linkedin_url ?? null,
                    cms: item.cms ?? null,
                    hosting: item.hosting ?? null,
                    email_provider: item.email_provider ?? null,
                    has_contact_form: item.has_contact_form ?? null,
                    has_blog: item.has_blog ?? null,
                    has_email_signup: item.has_email_signup ?? null,
                    email: item.email ?? null,
                  })
                  .select()
                  .single()

                if (!error && data) {
                  totalCount++
                  send({ type: 'lead', name: item.company_name, id: data.id })
                } else {
                  send({ type: 'error_item', name: item.company_name })
                }
              } catch {
                send({ type: 'error_item', name: item.company_name })
              }
            },
            (msg) => send({ type: 'status', message: msg }),
            activeProxy
          )

          if (!result.blocked) break

          send({
            type: 'blocked',
            attempt,
            message: `Google blocked the request (attempt ${attempt}/${MAX_RETRIES}) — rotating proxy...`,
          })
        }

        if (result.blocked) {
          send({
            type: 'error',
            message: 'All retries exhausted — Google is blocking all routes. Try again later or add more proxies.',
          })
        }

        send({ type: 'done', count: totalCount })
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
