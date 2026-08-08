import Link from 'next/link'

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
  formatMoney,
  inputClass,
  labelClass,
  PurchaseRequestStatusBadge,
} from '@/modules/procurement/presentation/components'
import {
  getProcurementError,
  getProcurementNotice,
} from '@/modules/procurement/presentation/feedback'
import { ListProjects } from '@/modules/projects/application/use-cases'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{
    status?: string | string[]
    project?: string | string[]
    priority?: string | string[]
    error?: string | string[]
    notice?: string | string[]
  }>
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ProcurementPage({ searchParams }: Props) {
  const access = await requireProcurementAccess()
  const query = await searchParams
  const status = first(query.status)
  const projectId = first(query.project)
  const priority = first(query.priority)

  const [requests, projects, settings] = await Promise.all([
    ListPurchaseRequests.execute({
      status: purchaseRequestStatuses.includes(status as never) ? status : undefined,
      projectId: projectId || undefined,
      priority: purchaseRequestPriorities.includes(priority as never) ? priority : undefined,
    }),
    ListProjects.execute(),
    GetApprovalSettings.execute(),
  ])

  const error = getProcurementError(query.error)
  const notice = getProcurementNotice(query.notice)

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-zinc-800 pb-8">
          <div>
            <Link className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300" href="/dashboard">
              Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Procurement</h1>
            <p className="mt-2 text-sm text-zinc-400">Solicitações de compra até aprovação final.</p>
          </div>
          <div className="flex gap-3">
            <Link className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900" href="/dashboard/approvals">
              Aprovações
            </Link>
            {access.can('Procurement.Create') ? (
              <Link className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white" href="/dashboard/procurement/new">
                Nova solicitação
              </Link>
            ) : null}
          </div>
        </header>

        {error ? <div className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">{error}</div> : null}
        {notice ? <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300" role="status">{notice}</div> : null}

        <form className="mt-8 grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-4" method="get">
          <label>
            <span className={labelClass}>Estado</span>
            <select className={inputClass} defaultValue={status ?? ''} name="status">
              <option value="">Todos</option>
              {purchaseRequestStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Projeto</span>
            <select className={inputClass} defaultValue={projectId ?? ''} name="project">
              <option value="">Todos</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Prioridade</span>
            <select className={inputClass} defaultValue={priority ?? ''} name="priority">
              <option value="">Todas</option>
              {purchaseRequestPriorities.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button className="w-full rounded-lg border border-zinc-700 px-4 py-2.5 text-sm hover:bg-zinc-800" type="submit">Filtrar</button>
          </div>
        </form>

        <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-800">
          {requests.length === 0 ? (
            <div className="bg-zinc-900 p-8 text-sm text-zinc-400">Não existem solicitações para os filtros atuais.</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {requests.map((request) => (
                <Link className="grid gap-3 bg-zinc-900 p-5 transition hover:bg-zinc-900/70 md:grid-cols-[1.1fr_1.2fr_1.5fr_1fr_1fr]" href={`/dashboard/procurement/${request.id}`} key={request.id}>
                  <div>
                    <p className="font-mono text-sm text-zinc-300">{request.requestNumber}</p>
                    <p className="mt-1 text-xs text-zinc-500">{new Date(request.createdAt).toLocaleDateString('pt-PT')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{request.projectName}</p>
                    <p className="mt-1 text-xs text-zinc-500">{request.requesterName ?? 'Utilizador'}</p>
                  </div>
                  <p className="line-clamp-2 text-sm text-zinc-300">{request.purpose}</p>
                  <div>
                    <p className="text-sm font-medium">{formatMoney(request.estimatedTotal, request.currency)}</p>
                    <p className="mt-1 text-xs capitalize text-zinc-500">{request.priority}</p>
                  </div>
                  <div className="md:text-right"><PurchaseRequestStatusBadge status={request.status} /></div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {access.membership.role === 'administrator' && settings ? (
          <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Limite de aprovação executiva</h2>
            <p className="mt-1 text-sm text-zinc-400">Se a moeda for diferente da moeda configurada, a revisão executiva é exigida por segurança.</p>
            <form action={updateApprovalSettingsAction} className="mt-5 grid gap-4 md:max-w-xl md:grid-cols-3">
              <label className="md:col-span-2">
                <span className={labelClass}>Threshold</span>
                <input className={inputClass} defaultValue={settings.executiveApprovalThreshold} min="0" name="threshold" step="0.01" type="number" />
              </label>
              <label>
                <span className={labelClass}>Moeda</span>
                <select className={inputClass} defaultValue={settings.currency} name="currency">
                  <option value="AOA">AOA</option><option value="USD">USD</option><option value="EUR">EUR</option>
                </select>
              </label>
              <button className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm hover:bg-zinc-800 md:col-span-3" type="submit">Guardar configuração</button>
            </form>
          </section>
        ) : null}
      </section>
    </main>
  )
}
