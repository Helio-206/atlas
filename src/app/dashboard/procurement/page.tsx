import Link from 'next/link'

import { Breadcrumbs, DataTable, Money, PageHeader } from '@/components/atlas/ui'
import { ListProjects } from '@/modules/projects/application/use-cases'
import {
  GetApprovalSettings,
  ListPurchaseRequests,
} from '@/modules/procurement/application/use-cases'
import {
  purchaseRequestPriorities,
  purchaseRequestStatuses,
} from '@/modules/procurement/domain/purchase-request'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { updateApprovalSettingsAction } from '@/modules/procurement/presentation/actions'
import {
  inputClass,
  labelClass,
  PurchaseRequestStatusBadge,
} from '@/modules/procurement/presentation/components'
import {
  getProcurementError,
  getProcurementNotice,
} from '@/modules/procurement/presentation/feedback'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ status?: string | string[]; project?: string | string[]; priority?: string | string[]; error?: string | string[]; notice?: string | string[] }> }

function first(value?: string | string[]) { return Array.isArray(value) ? value[0] : value }

export default async function ProcurementPage({ searchParams }: Props) {
  const access = await requireProcurementAccess()
  const query = await searchParams
  const status = first(query.status)
  const projectId = first(query.project)
  const priority = first(query.priority)
  const [requests, projects, settings] = await Promise.all([
    ListPurchaseRequests.execute({ status: purchaseRequestStatuses.includes(status as never) ? status : undefined, projectId: projectId || undefined, priority: purchaseRequestPriorities.includes(priority as never) ? priority : undefined }),
    ListProjects.execute(),
    GetApprovalSettings.execute(),
  ])
  const error = getProcurementError(query.error)
  const notice = getProcurementNotice(query.notice)

  return (
    <main>
      <Breadcrumbs items={[{ label: 'Compras' }, { label: 'Solicitações' }]} />
      <PageHeader actions={access.can('Procurement.Create') ? <Link className="atlas-button atlas-button-primary" href="/dashboard/procurement/new">Nova solicitação</Link> : undefined} description="Registo operacional de solicitações de compra." title="Solicitações de compra" />
      {error ? <div className="atlas-notice atlas-notice-error mt-4" role="alert">{error}</div> : null}
      {notice ? <div className="atlas-notice mt-4" role="status">{notice}</div> : null}

      <form className="mt-5 grid gap-4 border-b border-[var(--border)] pb-5 md:grid-cols-[1fr_1.4fr_1fr_auto]" method="get">
        <label><span className={labelClass}>Estado</span><select className={inputClass} defaultValue={status ?? ''} name="status"><option value="">Todos</option>{purchaseRequestStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span className={labelClass}>Projeto</span><select className={inputClass} defaultValue={projectId ?? ''} name="project"><option value="">Todos</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}</select></label>
        <label><span className={labelClass}>Prioridade</span><select className={inputClass} defaultValue={priority ?? ''} name="priority"><option value="">Todas</option>{purchaseRequestPriorities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <button className="atlas-button self-end" type="submit">Filtrar</button>
      </form>

      <section className="mt-5">
        <p className="mb-3 text-[13px] font-medium">Registo operacional</p>
        <div className="border-y border-[var(--border)]">
          <DataTable minWidth={900}>
            <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]"><tr><th className="px-2 py-3 font-medium">Número</th><th className="px-3 py-3 font-medium">Projeto</th><th className="px-3 py-3 font-medium">Finalidade</th><th className="px-3 py-3 text-right font-medium">Valor</th><th className="px-3 py-3 font-medium">Estado</th><th className="px-2 py-3 font-medium">Atualizado</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">{requests.length === 0 ? <tr><td className="py-8 text-center text-[var(--text-muted)]" colSpan={6}>Não existem solicitações para os filtros atuais.</td></tr> : requests.map((request) => <tr key={request.id}><td className="px-2 py-3"><Link className="atlas-link atlas-tabular" href={`/dashboard/procurement/${request.id}`}>{request.requestNumber}</Link></td><td className="px-3 py-3 text-[var(--text-secondary)]">{request.projectName}</td><td className="max-w-80 px-3 py-3 text-[var(--text-secondary)]"><span className="line-clamp-1">{request.purpose}</span></td><td className="px-3 py-3 text-right"><Money currency={request.currency} value={request.estimatedTotal} /></td><td className="px-3 py-3"><PurchaseRequestStatusBadge status={request.status} /></td><td className="atlas-tabular px-2 py-3 text-[var(--text-muted)]">{new Date(request.updatedAt).toLocaleString('pt-PT')}</td></tr>)}</tbody>
          </DataTable>
        </div>
      </section>

      {access.membership.role === 'administrator' && settings ? (
        <details className="mt-6 border-t border-[var(--border)] pt-5">
          <summary className="cursor-pointer text-[13px] font-medium">Configuração de aprovação executiva</summary>
          <p className="mt-2 text-[12px] text-[var(--text-muted)]">Moeda diferente da configurada exige revisão executiva.</p>
          <form action={updateApprovalSettingsAction} className="mt-4 grid gap-4 md:max-w-xl md:grid-cols-3">
            <label className="md:col-span-2"><span className={labelClass}>Limite</span><input className={inputClass} defaultValue={settings.executiveApprovalThreshold} min="0" name="threshold" step="0.01" type="number" /></label>
            <label><span className={labelClass}>Moeda</span><select className={inputClass} defaultValue={settings.currency} name="currency"><option value="AOA">AOA</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
            <button className="atlas-button justify-self-start md:col-span-3" type="submit">Guardar configuração</button>
          </form>
        </details>
      ) : null}
    </main>
  )
}
