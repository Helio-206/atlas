import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()

  if (!error && data?.claims) {
    redirect('/dashboard')
  }

  redirect('/login')
}
