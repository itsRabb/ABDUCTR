// supabase/functions/session-refresh/index.ts
// Supabase Edge Function — Deno runtime
// Validates and refreshes a Supabase auth session from a Bearer token.
//
// Deploy:   supabase functions deploy session-refresh
// Invoke:   POST https://<project>.supabase.co/functions/v1/session-refresh
//           Authorization: Bearer <access_token>
//           Body: { "refresh_token": "<refresh_token>" }  (optional — forces token refresh)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
    }

    // Extract the Bearer token from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '')

    // Parse optional refresh_token from body
    let refreshToken: string | undefined
    try {
      const body = await req.json()
      refreshToken = body?.refresh_token
    } catch {
      // Body is optional — no-op
    }

    // Create a Supabase client scoped to this user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    })

    // If a refresh_token was provided, do a full token refresh
    if (refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          user: data.user,
          session: {
            access_token: data.session?.access_token,
            refresh_token: data.session?.refresh_token,
            expires_at: data.session?.expires_at,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Otherwise just validate the current token
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return new Response(
        JSON.stringify({ error: error?.message ?? 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ user, valid: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
