import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'

import { ListProjects } from '@/modules/projects/application/use-cases'
import {
  GetApprovalSettings,
  GetPurchaseRequest,
  ListPurchaseRequestAudit,
  ListPurchaseRequestDecisions,
  ListPurchaseRequestItems,
} from '@/modules/procurement/application/use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import {
  addPurchaseRequestItemAction,
  approveExecutiveReviewAction,
  approveFinancialReviewAction,
  approveTechnicalReviewAction,
  cancelPurchaseRequestAction,
  rejectPurchaseRequestAction,
  removePurchaseRequestItemAction,
  returnPurchaseRequestAction,
  submitPurchaseRequestAction,
  updatePurchaseRequestAction,
  updatePurchaseRequestItemAction,
} from '@/modules/procurement/presentation/actions'
import {
  formatMoney,
  inputClass,
  labelClass,
  PurchaseRequestStatusBadge,
} from '@/modules/procurement/presentation/components'
import { getProcurementError, getProcurementNotice } from '@/modules/procurement/presentation/feedback'

export const dynamic = 'force-dynamic'

const idSchema = z.string().uuid()

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>
}

export default async function PurchaseRequestPage({ params, searchParams }: Props) {
  const access = await requireProcurementAccess()
  const { id } = await params
  if (!idSchema.safeParse(id).success) notFound()

  const request = await GetPurchaseRequest.execute(id)
  if (!request) notFound()

  const [items, decisions, audit, settings, projects] = await Promise.all([
    ListPurchaseRequestItems.execute(id),
    ListPurchaseRequestDecisions.execute(id),
    ListPurchaseRequestAudit.execute(id),
    GetApprovalSettings.execute(),
    ListProjects.execute(),
  ])

  const query = await searchParams
  const error = getProcurementError(query.error)
  const notice = getProcurementNotice(query.notice)
  const ownRequest = request.requestedBy === access.userId
  const editable = ownRequest && access.can('Procurement.EditOwn') && ['draft', 'returned'].includes(request.status)
  const reviewable = !ownRequest
  const canCancel = access.can('Procurement.Cancel') && (ownRequest || access.membership.role === 'administrator') && !['approved', 'rejected', 'cancelled'].includes(request.status)
  const activeProjects = projects.filter((project) => project.status === 'active')

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-zinc-800 pb-8">
          <div>
            <Link className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300" href="/dashboard/procurement">Procurement</Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold">{request.requestNumber}</h1>
              <PurchaseRequestStatusBadge status={request.status} />
            </div>
            <p className="mt-2 text-sm text-zinc-400">{request.projectName} · versão {request.version}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total estimado</p>
            <p className="mt-2 text-2xl font-semibold">{formatMoney(request.estimatedTotal, request.currency)}</p>
          </div>
        </header>

        {error ? <div className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">{error}</div> : null}
        {notice ? <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300" role="status">{notice}</div> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Meta label="Solicitante" value={request.requesterName ?? 'Utilizador'} />
          <Meta label="Prioridade" value={request.priority} />
          <Meta label="Data necessária" value={request.requiredDate} />
          <Meta label="Moeda" value={request.currency} />
        </div>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Dados da solicitação</h2>
          {editable ? (
            <form action={updatePurchaseRequestAction} className="mt-5 grid gap-4 md:grid-cols-2">
              <input name="purchase_request_id" type="hidden" value={request.id} />
              <input name="expected_version" type="hidden" value={request.version} />
              <label><span className={labelClass}>Projeto</span><select className={inputClass} defaultValue={request.projectId} name="project_id">{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}</select></label>
              <label><span className={labelClass}>Prioridade</span><select className={inputClass} defaultValue={request.priority} name="priority"><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
              <label><span className={labelClass}>Data necessária</span><input className={inputClass} defaultValue={request.requiredDate} name="required_date" type="date" /></label>
              <label><span className={labelClass}>Moeda</span><select className={inputClass} defaultValue={request.currency} name="currency"><option value="AOA">AOA</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
              <label className="md:col-span-2"><span className={labelClass}>Finalidade</span><textarea className={`${inputClass} min-h-24`} defaultValue={request.purpose} name="purpose" /></label>
              <button className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm hover:bg-zinc-800 md:col-span-2" type="submit">Guardar alterações</button>
            </form>
          ) : <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{request.purpose}</p>}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Itens</h2><span className="text-sm text-zinc-500">{items.length} item(ns)</span></div>
          <div className="mt-5 space-y-4">
            {items.length === 0 ? <p className="text-sm text-zinc-500">Ainda não existem itens.</p> : items.map((item) => editable ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4" key={item.id}>
                <form action={updatePurchaseRequestItemAction} className="grid gap-3 md:grid-cols-5">
                  <input name="purchase_request_id" type="hidden" value={request.id} /><input name="item_id" type="hidden" value={item.id} /><input name="expected_version" type="hidden" value={request.version} />
                  <input aria-label={`Descrição ${item.description}`} className={`${inputClass} md:col-span-2`} defaultValue={item.description} name="description" />
                  <input aria-label={`Quantidade ${item.description}`} className={inputClass} defaultValue={item.quantity} min="0.0001" name="quantity" step="0.0001" type="number" />
                  <input aria-label={`Unidade ${item.description}`} className={inputClass} defaultValue={item.unit} name="unit" />
                  <input aria-label={`Preço ${item.description}`} className={inputClass} defaultValue={item.estimatedUnitPrice} min="0" name="estimated_unit_price" step="0.01" type="number" />
                  <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 md:col-span-5" type="submit">Atualizar item</button>
                </form>
                <form action={removePurchaseRequestItemAction} className="mt-2 text-right"><input name="purchase_request_id" type="hidden" value={request.id} /><input name="item_id" type="hidden" value={item.id} /><input name="expected_version" type="hidden" value={request.version} /><button className="text-sm text-zinc-500 hover:text-red-300" type="submit">Remover item</button></form>
              </div>
            ) : (
              <div className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-[2fr_1fr_1fr_1fr]" key={item.id}><span>{item.description}</span><span>{item.quantity} {item.unit}</span><span>{formatMoney(item.estimatedUnitPrice, request.currency)}</span><span className="text-right font-medium">{formatMoney(item.quantity * item.estimatedUnitPrice, request.currency)}</span></div>
            ))}
          </div>

          {editable ? (
            <form action={addPurchaseRequestItemAction} className="mt-6 grid gap-3 border-t border-zinc-800 pt-5 md:grid-cols-5">
              <input name="purchase_request_id" type="hidden" value={request.id} /><input name="expected_version" type="hidden" value={request.version} />
              <input aria-label="Nova descrição" className={`${inputClass} md:col-span-2`} name="description" placeholder="Descrição" />
              <input aria-label="Nova quantidade" className={inputClass} defaultValue="1" min="0.0001" name="quantity" step="0.0001" type="number" />
              <input aria-label="Nova unidade" className={inputClass} defaultValue="un" name="unit" />
              <input aria-label="Novo preço estimado" className={inputClass} defaultValue="0" min="0" name="estimated_unit_price" step="0.01" type="number" />
              <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 md:col-span-5" type="submit">Adicionar item</button>
            </form>
          ) : null}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Actions</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {ownRequest && access.can('Procurement.Submit') && ['draft', 'returned'].includes(request.status) ? <CommandForm action={submitPurchaseRequestAction} label="Submeter" requestId={request.id} version={request.version} /> : null}
            {canCancel ? <CommandForm action={cancelPurchaseRequestAction} label="Cancelar" requestId={request.id} version={request.version} /> : null}
            {reviewable && request.status === 'technical_review' && access.can('Procurement.TechnicalApprove') ? <DecisionForm approveAction={approveTechnicalReviewAction} requestId={request.id} version={request.version} /> : null}
            {reviewable && request.status === 'financial_review' && access.can('Procurement.FinancialApprove') ? <DecisionForm approveAction={approveFinancialReviewAction} requestId={request.id} version={request.version} /> : null}
            {reviewable && request.status === 'executive_review' && access.can('Procurement.ExecutiveApprove') ? <DecisionForm approveAction={approveExecutiveReviewAction} requestId={request.id} version={request.version} /> : null}
          </div>
          {request.status === 'financial_review' && settings ? <p className="mt-4 text-xs text-zinc-500">Threshold executivo: {formatMoney(settings.executiveApprovalThreshold, settings.currency)}. Moeda diferente força revisão executiva.</p> : null}
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Approval Timeline</h2>
            <div className="mt-5 space-y-4">{decisions.length === 0 ? <p className="text-sm text-zinc-500">Sem decisões ainda.</p> : decisions.map((decision) => <div className="border-l border-zinc-700 pl-4" key={decision.id}><p className="text-sm font-medium capitalize">{decision.stage} · {decision.decision}</p><p className="mt-1 text-xs text-zinc-500">{decision.decidedByName ?? 'Utilizador'} · {new Date(decision.createdAt).toLocaleString('pt-PT')}</p>{decision.comment ? <p className="mt-2 text-sm text-zinc-400">{decision.comment}</p> : null}</div>)}</div>
          </section>
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Audit Timeline</h2>
            <div className="mt-5 space-y-4">{audit.map((entry, index) => <div className="border-l border-zinc-700 pl-4" key={`${entry.createdAt}-${index}`}><p className="text-sm font-medium">{entry.action}</p><p className="mt-1 text-xs text-zinc-500">{new Date(entry.createdAt).toLocaleString('pt-PT')}</p><p className="mt-2 break-all font-mono text-xs text-zinc-500">{JSON.stringify(entry.metadata)}</p></div>)}</div>
          </section>
        </div>
      </section>
    </main>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-2 text-sm capitalize text-zinc-200">{value}</p></div>
}

function CommandForm({ action, label, requestId, version }: { action: (formData: FormData) => void | Promise<void>; label: string; requestId: string; version: number }) {
  return <form action={action}><input name="purchase_request_id" type="hidden" value={requestId} /><input name="expected_version" type="hidden" value={version} /><button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800" type="submit">{label}</button></form>
}

function DecisionForm({ approveAction, requestId, version }: { approveAction: (formData: FormData) => void | Promise<void>; requestId: string; version: number }) {
  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <form action={approveAction} className="flex flex-wrap gap-3"><input name="purchase_request_id" type="hidden" value={requestId} /><input name="expected_version" type="hidden" value={version} /><input className={`${inputClass} min-w-64 flex-1`} name="comment" placeholder="Comentário opcional" /><button className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950" type="submit">Aprovar</button></form>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <form action={returnPurchaseRequestAction} className="flex gap-2"><input name="purchase_request_id" type="hidden" value={requestId} /><input name="expected_version" type="hidden" value={version} /><input className={inputClass} name="comment" placeholder="Motivo da devolução" /><button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm" type="submit">Devolver</button></form>
        <form action={rejectPurchaseRequestAction} className="flex gap-2"><input name="purchase_request_id" type="hidden" value={requestId} /><input name="expected_version" type="hidden" value={version} /><input className={inputClass} name="comment" placeholder="Motivo da rejeição" /><button className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300" type="submit">Rejeitar</button></form>
      </div>
    </div>
  )
}
