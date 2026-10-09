import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client (browser).
 *
 * The anon key is public by design (BRIEF §J) — it ships in the built site and
 * the real security boundary is row-level security on every table, not key
 * secrecy. NEVER put the service_role key here; it must never reach the client.
 */
export const SUPABASE_URL = 'https://sfunpylcbaorbmgvlxpz.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdW5weWxjYmFvcmJtZ3ZseHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MjE0OTMsImV4cCI6MjEwNzA5NzQ5M30.oT8cjjppR8AA5kuCamLKZM1cAr03GKdgLfVZzhN_tTc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // completes the magic-link return
  },
});

/** Base-aware absolute URL for a site path — used for auth redirects. */
export function siteUrl(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const clean = path.replace(/^\/+/, '');
  return `${window.location.origin}${base}/${clean}`;
}
