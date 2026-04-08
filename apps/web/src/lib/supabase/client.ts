import { createBrowserClient } from '@supabase/ssr'

// Use in client components ('use client').
// Call this function directly inside the component — do not store as a module-level singleton.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
