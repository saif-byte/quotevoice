import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase connection (free tier): accounts, synced quotes, short customer links,
 * and the server-side AI reader.
 *
 * The publishable key is meant to live in the browser. It can only do what the
 * database's row-level security rules allow: each painter reaches only their own
 * rows, and homeowners only reach the two public functions (view and accept).
 * The secret service key is never used in the app.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://vmyxhleijilablgbdvny.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_4LlUIOVov6QYfQMlMXiVvQ_W1vz50M3'

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_KEY && typeof window !== 'undefined'
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // The app uses #/ routes, so auth must not put tokens in the URL hash.
          flowType: 'pkce',
          detectSessionInUrl: true,
        },
      })
    : null

export const supabaseUrl = SUPABASE_URL
export const supabaseKey = SUPABASE_KEY
