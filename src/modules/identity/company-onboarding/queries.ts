import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

type ActiveMembership = {
  company_id: string
  role: string
}

export async function getActiveMembership(): Promise<ActiveMembership | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .schema('identity')
    .from('memberships')
    .select('company_id, role')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to resolve active company membership: ${error.code}`)
  }

  return data
}
