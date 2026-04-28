import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
    )
  }

  _client = createClient(url, key, {
    auth: {
      // Service role key must not persist sessions — it acts as a super-user
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return _client
}
