import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AppShell } from '@/components/atlas/app-shell'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getActiveMembership } from '@/modules/identity/company-onboarding/queries'
import { canManageDemoRequestsRepository } from '@/modules/identity/admin/infrastructure/admin-repository'
import { CountUnreadNotifications, ListNotifications } from '@/modules/notifications/application/notification-use-cases'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/login?error=session_required')

  const membership = await getActiveMembership()
  if (!membership) redirect('/onboarding/company')

  const [{ data: company }, { data: profile }, notifications, unreadCount, canManageDemoRequests] = await Promise.all([
    supabase.schema('identity').from('companies').select('name').eq('id', membership.company_id).maybeSingle(),
    supabase.schema('identity').from('profiles').select('full_name').maybeSingle(),
    ListNotifications(5),
    CountUnreadNotifications(),
    canManageDemoRequestsRepository(),
  ])

  const email = typeof data.claims.email === 'string' ? data.claims.email : 'Utilizador'

  return (
    <AppShell
      identity={{
        companyName: company?.name ?? 'Empresa atual',
        userName: profile?.full_name || email,
        role: roleLabel(membership.role),
        roleKey: membership.role,
        canManageDemoRequests,
      }}
      notifications={{
        unreadCount,
        items: notifications.map((item) => ({ id: item.id, title: item.title, href: item.href, createdAt: item.createdAt, read: Boolean(item.readAt) })),
      }}
    >
      {children}
    </AppShell>
  )
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    administrator: 'Administrador',
    project_manager: 'Gestor de Projeto',
    requester: 'Solicitante',
    technical_reviewer: 'Aprovador Técnico',
    financial_approver: 'Aprovador Financeiro',
    executive_approver: 'Diretor',
    procurement_officer: 'Responsável de Compras',
    warehouse_operator: 'Responsável de Armazém',
  }
  return labels[role] ?? role.replaceAll('_', ' ')
}
