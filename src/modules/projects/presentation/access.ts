import 'server-only'

import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getActiveMembership } from '@/modules/identity/company-onboarding/queries'

export async function requireProjectsAccess() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/login?error=session_required')
  }

  const membership = await getActiveMembership()

  if (!membership) {
    redirect('/onboarding/company')
  }

  return membership
}
