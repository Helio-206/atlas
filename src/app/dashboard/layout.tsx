import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AppShell } from '@/components/atlas/app-shell'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getActiveMembership } from '@/modules/identity/company-onboarding/queries'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/login?error=session_required')

  const membership = await getActiveMembership()
  if (!membership) redirect('/onboarding/company')

  const [{ data: company }, { data: profile }] = await Promise.all([
    supabase.schema('identity').from('companies').select('name').eq('id', membership.company_id).maybeSingle(),
    supabase.schema('identity').from('profiles').select('full_name').maybeSingle(),
  ])

  const email = typeof data.claims.email === 'string' ? data.claims.email : 'Utilizador'

  return (
    <AppShell
      identity={{
        companyName: company?.name ?? 'Empresa atual',
        userName: profile?.full_name || email,
        role: roleLabel(membership.role),
      }}
    >
      {children}
    </AppShell>
  )
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    administrator: 'Administrador',
    requester: 'Solicitante',
    technical_reviewer: 'Revisor técnico',
    financial_reviewer: 'Revisor financeiro',
    executive_reviewer: 'Revisor executivo',
    procurement_officer: 'Comprador',
    warehouse_operator: 'Operador de armazém',
  }
  return labels[role] ?? role.replaceAll('_', ' ')
}
