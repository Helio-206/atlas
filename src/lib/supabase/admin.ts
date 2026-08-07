import 'server-only'

import { createClient } from '@supabase/supabase-js'

function getAdminEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL',
    )
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  return { serviceRoleKey, supabaseUrl }
}

export function createAdminSupabaseClient() {
  const { serviceRoleKey, supabaseUrl } = getAdminEnvironment()

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
