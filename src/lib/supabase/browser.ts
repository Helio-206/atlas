import { createBrowserClient } from '@supabase/ssr'

function getBrowserEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL',
    )
  }

  if (!supabasePublishableKey) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    )
  }

  return { supabasePublishableKey, supabaseUrl }
}

export function createBrowserSupabaseClient() {
  const { supabasePublishableKey, supabaseUrl } = getBrowserEnvironment()

  return createBrowserClient(supabaseUrl, supabasePublishableKey)
}
