import { notFound } from 'next/navigation'

import { DataTable, PageHeader, SectionHeader, StatusBadge } from '@/components/atlas/ui'
import { listCompanyMembersRepository } from '@/modules/identity/admin/infrastructure/admin-repository'
import { setMembershipStatusAction, updatePilotApprovalSettingsAction } from '@/modules/identity/admin/presentation/actions'
import { GetApprovalSettings } from '@/modules/procurement/application/use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }> }

export default async function UsersPage({ searchParams }: Props) {
  const access = await requireProcurementAccess()
  if (access.membership.role !== 'administrator') notFound()
  const [members, settings, query] = await Promise.all([listCompanyMembersRepository(), GetApprovalSettings.execute(), searchParams])
  const error = first(query.error)
  const notice = first(query.notice)

  return (
    <main>
      <PageHeader description="Acesso à empresa e parâmetros mínimos de aprovação." title="Utilizadores" />
      {error ? <div className="atlas-notice atlas-notice-error mt-4" role="alert">Não foi possível concluir a alteração.</div> : null}
      {notice ? <div className="atlas-notice mt-4" role="status">Alteração guardada.</div> : null}

      <section className="mt-5">
        <SectionHeader description="Papéis operacionais existentes. Não existe edição livre de RBAC nesta fase." title="Acessos da empresa" />
        <div className="mt-3 border-y border-[var(--border)]">
          <DataTable minWidth={850}>
            <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]">
              <tr><th className="px-2 py-3 font-medium">Utilizador</th><th className="px-3 py-3 font-medium">Email</th><th className="px-3 py-3 font-medium">Função</th><th className="px-3 py-3 font-medium">Estado</th><th className="px-2 py-3 text-right font-medium">Ação</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {members.map((member) => (
                <tr key={member.membershipId}>
                  <td className="px-2 py-3 font-medium">{member.fullName ?? 'Sem nome'}</td>
                  <td className="px-3 py-3 text-[var(--text-secondary)]">{member.email}</td>
                  <td className="px-3 py-3 text-[var(--text-secondary)]">{roleLabel(member.role)}</td>
                  <td className="px-3 py-3"><StatusBadge label={member.status === 'active' ? 'Ativo' : member.status === 'suspended' ? 'Suspenso' : 'Convidado'} tone={member.status === 'active' ? 'success' : 'neutral'} /></td>
                  <td className="px-2 py-3 text-right">
                    {member.userId !== access.userId && ['active', 'suspended'].includes(member.status) ? (
                      <form action={setMembershipStatusAction}>
                        <input name="membership_id" type="hidden" value={member.membershipId} />
                        <input name="expected_status" type="hidden" value={member.status} />
                        <input name="status" type="hidden" value={member.status === 'active' ? 'suspended' : 'active'} />
                        <button className="atlas-link text-[11px]" type="submit">{member.status === 'active' ? 'Suspender' : 'Ativar'}</button>
                      </form>
                    ) : <span className="text-[11px] text-[var(--text-muted)]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </section>

      <section className="mt-6 border-t border-[var(--border)] pt-5">
        <SectionHeader description="Solicitações iguais ou acima deste valor seguem para aprovação executiva quando a moeda coincide." title="Threshold executivo" />
        <form action={updatePilotApprovalSettingsAction} className="mt-4 grid max-w-xl grid-cols-[1fr_120px_auto] items-end gap-3">
          <label className="text-[11px] text-[var(--text-secondary)]">Valor<input className="atlas-input mt-1 w-full" min="0" name="threshold" required step="0.01" type="number" defaultValue={settings?.executiveApprovalThreshold ?? 1000000} /></label>
          <label className="text-[11px] text-[var(--text-secondary)]">Moeda<select className="atlas-input mt-1 w-full" defaultValue={settings?.currency ?? 'AOA'} name="currency"><option>AOA</option><option>USD</option><option>EUR</option></select></label>
          <button className="atlas-button atlas-button-primary" type="submit">Guardar</button>
        </form>
      </section>
    </main>
  )
}

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }
function roleLabel(role: string) {
  return ({ administrator: 'Administrador', project_manager: 'Gestor de Projeto', requester: 'Solicitante', technical_reviewer: 'Aprovador Técnico', financial_approver: 'Aprovador Financeiro', executive_approver: 'Diretor', procurement_officer: 'Responsável de Compras', warehouse_operator: 'Responsável de Armazém' } as Record<string,string>)[role] ?? role.replaceAll('_',' ')
}
