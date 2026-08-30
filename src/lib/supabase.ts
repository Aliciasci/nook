import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[Nook] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — auth and data persistence are disabled. Copy .env.example to .env and fill them in.',
  )
}

// Falls back to harmless placeholder values when unconfigured so the client
// can still be constructed (and the app can render a clear "not configured"
// state) instead of crashing at import time.
export const supabase = createClient<Database>(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
