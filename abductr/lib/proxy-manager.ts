// lib/proxy-manager.ts
// Server-side only — picks a random proxy from the DB for Puppeteer rotation.

import { createClient } from '@supabase/supabase-js'
import type { ProxyEntry } from './types'

export async function getActiveProxy(): Promise<ProxyEntry | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('proxies')
      .select('*')
      .order('last_checked', { ascending: false })
      .limit(200)

    if (error || !data || data.length === 0) return null

    // Random pick from the pool
    const idx = Math.floor(Math.random() * data.length)
    return data[idx] as ProxyEntry
  } catch {
    return null
  }
}

export async function isProxyEnabled(): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('app_settings')
      .select('proxy_enabled')
      .eq('id', 1)
      .single()

    return data?.proxy_enabled ?? false
  } catch {
    return false
  }
}
