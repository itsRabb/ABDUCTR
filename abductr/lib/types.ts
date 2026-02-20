export type EstimatedSize = 'Small' | 'Medium' | 'Large'
export type Budget = 'Low' | 'Medium' | 'High'
export type Timing = 'Immediate' | '30 days' | '90 days' | 'Not sure'
export type Channel = 'Email' | 'LinkedIn' | 'Phone' | 'Other'
export type ResponseStatus = 'No response' | 'Interested' | 'Not interested' | 'Converted'

// Which enrichment field groups to collect during scraping
export type ScrapeFieldGroup = 'google_extra' | 'social' | 'tech_stack' | 'marketing' | 'email'

export interface Lead {
  id: string
  company_name: string
  contact_name: string | null
  role: string | null
  email: string | null
  phone: string | null
  website: string | null
  city: string | null
  state: string | null
  business_type: string | null
  // Google Maps extra
  rating: number | null
  review_count: number | null
  address_full: string | null
  hours: string | null
  location_count: string | null
  // Social
  instagram: string | null
  facebook: string | null
  linkedin_url: string | null
  // Tech stack
  cms: string | null
  hosting: string | null
  email_provider: string | null
  // Marketing signals
  has_contact_form: boolean | null
  has_blog: boolean | null
  has_email_signup: boolean | null
  // Legacy BANT
  qr_usage: boolean | null
  analytics_present: boolean | null
  estimated_size: EstimatedSize | null
  budget: Budget | null
  authority: boolean | null
  need_level: number | null
  timing: Timing | null
  contacted: boolean | null
  date_contacted: string | null
  channel: Channel | null
  response_status: ResponseStatus | null
  follow_up_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at'>
export type LeadUpdate = Partial<LeadInsert>

// ─── Proxy ─────────────────────────────────────────────────────────────────

export interface ProxyEntry {
  id: string
  host: string
  port: number
  protocol: 'http' | 'https'
  country: string | null
  last_checked: string
}

// ─── App Settings (singleton row) ──────────────────────────────────────────

export interface AppSettings {
  id: number
  proxy_enabled: boolean
  proxy_last_refreshed: string | null
  updated_at: string
}

// ─── BANT Score helper ─────────────────────────────────────────────────────

export function computeBantScore(lead: Pick<Lead, 'need_level' | 'budget' | 'authority' | 'timing'>): number {
  let score = 0
  if (lead.need_level) score += (lead.need_level / 5) * 40
  if (lead.budget === 'High') score += 30
  else if (lead.budget === 'Medium') score += 20
  else if (lead.budget === 'Low') score += 10
  if (lead.authority) score += 20
  if (lead.timing === 'Immediate') score += 10
  else if (lead.timing === '30 days') score += 7
  else if (lead.timing === '90 days') score += 4
  return Math.round(score)
}

export function bantScoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Hot', color: '#4ade80' }
  if (score >= 40) return { label: 'Warm', color: '#facc15' }
  return { label: 'Cold', color: '#f87171' }
}
