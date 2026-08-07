import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getServerEnvironment() {
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

export async function createServerSupabaseClient() {
  const { supabasePublishableKey, supabaseUrl } = getServerEnvironment()
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              sameSite: options.sameSite ?? 'lax',
              secure:
                process.env.NODE_ENV === 'production'
                  ? true
                  : options.secure,
            })
          })
        } catch {
          // Server Components cannot mutate cookies. The request proxy refreshes
          // sessions and persists cookie changes before protected content renders.
        }
      },
    },
  })
}
