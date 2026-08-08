import 'server-only'

import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getActiveMembership } from '@/modules/identity/company-onboarding/queries'

import { GetProcurementPermissions } from '../application/use-cases'
import type { ProcurementPermission } from '../domain/permissions'

export async function requireProcurementAccess() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/login?error=session_required')
  }

  const membership = await getActiveMembership()
  if (!membership) {
    redirect('/onboarding/company')
  }

  const userId = typeof data.claims.sub === 'string' ? data.claims.sub : null
  if (!userId) {
    redirect('/login?error=session_required')
  }

  const permissions = await GetProcurementPermissions.execute()

  return {
    membership,
    userId,
    permissions,
    can(permission: ProcurementPermission) {
      return permissions.includes(permission)
    },
  }
}
