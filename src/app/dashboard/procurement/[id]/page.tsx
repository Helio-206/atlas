import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { z } from 'zod'

import {
  ActivityList,
  ApprovalTimeline,
  Breadcrumbs,
  DataTable,
  Money,
  PageHeader,
  SectionHeader,
  Tabs,
} from '@/components/atlas/ui'
import { ListProjects } from '@/modules/projects/application/use-cases'
import {
  GetApprovalSettings,
  GetPurchaseRequest,
  ListPurchaseRequestAudit,
  ListPurchaseRequestDecisions,
  ListPurchaseRequestItems,
} from '@/modules/procurement/application/use-cases'
import type { PurchaseRequestStatus } from '@/modules/procurement/domain/purchase-request'
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
  inputClass,
  labelClass,
  PurchaseRequestStatusBadge,
} from '@/modules/procurement/presentation/components'
import { getProcurementError, getProcurementNotice } from '@/modules/procurement/presentation/feedback'
import { SourcingSummary } from '@/modules/procurement/presentation/sourcing-summary'

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

  const [items, decisions, audit, settings, projects, query] = await Promise.all([
    ListPurchaseRequestItems.execute(id),
    ListPurchaseRequestDecisions.execute(id),
    ListPurchaseRequestAudit.execute(id),
    GetApprovalSettings.execute(),
    ListProjects.execute(),
    searchParams,
  ])

  const error = getProcurementError(query.error)
  const notice = getProcurementNotice(query.notice)
  const ownRequest = request.requestedBy === access.userId
  const editable = ownRequest && access.can('Procurement.EditOwn') && ['draft', 'returned'].includes(request.status)
  const reviewable = !ownRequest
  const canCancel = access.can('Procurement.Cancel') && (ownRequest || access.membership.role === 'administrator') && !['approved', 'supplier_selected', 'ordered', 'partially_received', 'received', 'rejected', 'cancelled'].includes(request.status)
  const activeProjects = projects.filter((project) => project.status === 'active')
  const approvalAction = request.status === 'technical_review'
    ? approveTechnicalReviewAction
    : request.status === 'financial_review'
      ? approveFinancialReviewAction
      : approveExecutiveReviewAction
  const canReview = reviewable && (
    (request.status === 'technical_review' && access.can('Procurement.TechnicalApprove')) ||
    (request.status === 'financial_review' && access.can('Procurement.FinancialApprove')) ||
    (request.status === 'executive_review' && access.can('Procurement.ExecutiveApprove'))
  )

  return (
    <main>
      <Breadcrumbs items={[
        { label: 'Compras' },
        { label: 'Solicitações', href: '/dashboard/procurement' },
        { label: request.requestNumber },
      ]} />

      <PageHeader
        actions={
          canReview ? (
            <DecisionForm approveAction={approvalAction} requestId={request.id} version={request.version} />
          ) : (
            <div className="flex gap-2">
              {ownRequest && access.can('Procurement.Submit') && ['draft', 'returned'].includes(request.status) ? <CommandForm action={submitPurchaseRequestAction} label="Submeter" primary requestId={request.id} version={request.version} /> : null}
              {canCancel ? <CommandForm action={cancelPurchaseRequestAction} label="Cancelar" requestId={request.id} version={request.version} /> : null}
            </div>
          )
        }
        description={<><span className="font-medium text-[var(--text-primary)]">{request.purpose}</span><span className="mt-1 block">Projeto: {request.projectName}</span></>}
        title={request.requestNumber}
      >
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 lg:grid-cols-[1.2fr_0.8fr_0.9fr_1fr]">
          <HeaderMeta label="Valor estimado" value={<Money currency={request.currency} strong value={request.estimatedTotal} />} />
          <HeaderMeta label="Prioridade" value={<span className="capitalize">{priorityLabel(request.priority)}</span>} />
          <HeaderMeta label="Data necessária" value={new Date(`${request.requiredDate}T00:00:00`).toLocaleDateString('pt-PT')} />
          <HeaderMeta label="Estado" value={<PurchaseRequestStatusBadge status={request.status} />} />
        </div>
        {canReview ? <p className="mt-4 text-[11px] text-[var(--text-muted)]">Esta solicitação está pronta para decisão {reviewLabel(request.status)}.</p> : null}
      </PageHeader>

      {error ? <div className="atlas-notice atlas-notice-error mt-4" role="alert">{error}</div> : null}
      {notice ? <div className="atlas-notice mt-4" role="status">{notice}</div> : null}

      <div className="mt-4">
        <Tabs items={[
          { label: 'Visão geral', href: '#overview', active: true },
          { label: 'Itens', href: '#items' },
          { label: 'Aprovações', href: '#approvals' },
          { label: 'Cotações', href: '#quotations' },
          { label: 'Ordem de compra', href: '#purchase-order' },
          { label: 'Receções', href: '#receipts' },
          { label: 'Atividade', href: '#activity' },
        ]} />
      </div>

      <section className="scroll-mt-6 py-5" id="overview">
        <SectionHeader title="Visão geral" />
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 border-b border-[var(--border)] pb-5 md:grid-cols-4">
          <Meta label="Solicitante" value={request.requesterName ?? 'Utilizador'} />
          <Meta label="Criada em" value={new Date(request.createdAt).toLocaleString('pt-PT')} />
          <Meta label="Moeda" value={request.currency} />
          <Meta label="Última atualização" value={new Date(request.updatedAt).toLocaleString('pt-PT')} />
        </div>

        {editable ? (
          <form action={updatePurchaseRequestAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <input name="purchase_request_id" type="hidden" value={request.id} />
            <input name="expected_version" type="hidden" value={request.version} />
            <label><span className={labelClass}>Projeto</span><select className={inputClass} defaultValue={request.projectId} name="project_id">{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}</select></label>
            <label><span className={labelClass}>Prioridade</span><select className={inputClass} defaultValue={request.priority} name="priority"><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
            <label><span className={labelClass}>Data necessária</span><input className={inputClass} defaultValue={request.requiredDate} name="required_date" type="date" /></label>
            <label><span className={labelClass}>Moeda</span><select className={inputClass} defaultValue={request.currency} name="currency"><option value="AOA">AOA</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
            <label className="md:col-span-2"><span className={labelClass}>Finalidade</span><input className={inputClass} defaultValue={request.purpose} name="purpose" /></label>
            <button className="atlas-button justify-self-start md:col-span-2" type="submit">Guardar alterações</button>
          </form>
        ) : null}
      </section>

      <section className="scroll-mt-6 border-t border-[var(--border)] pt-5" id="items">
        <SectionHeader description={`${items.length} item(ns)`} title="Itens solicitados" />
        <div className="mt-3 border-y border-[var(--border)]">
          {editable ? (
            <div className="divide-y divide-[var(--border)]">
              {items.map((item) => (
                <div className="py-3" key={item.id}>
                  <form action={updatePurchaseRequestItemAction} className="grid gap-3 md:grid-cols-[2fr_0.7fr_0.7fr_1fr_auto]">
                    <input name="purchase_request_id" type="hidden" value={request.id} /><input name="item_id" type="hidden" value={item.id} /><input name="expected_version" type="hidden" value={request.version} />
                    <label><span className={labelClass}>Descrição</span><input aria-label={`Descrição ${item.description}`} className={inputClass} defaultValue={item.description} name="description" /></label>
                    <label><span className={labelClass}>Quantidade</span><input aria-label={`Quantidade ${item.description}`} className={inputClass} defaultValue={item.quantity} min="0.0001" name="quantity" step="0.0001" type="number" /></label>
                    <label><span className={labelClass}>Unidade</span><input aria-label={`Unidade ${item.description}`} className={inputClass} defaultValue={item.unit} name="unit" /></label>
                    <label><span className={labelClass}>Preço unitário</span><input aria-label={`Preço ${item.description}`} className={inputClass} defaultValue={item.estimatedUnitPrice} min="0" name="estimated_unit_price" step="0.01" type="number" /></label>
                    <button className="atlas-button self-end" type="submit">Atualizar</button>
                  </form>
                  <form action={removePurchaseRequestItemAction} className="mt-2 text-right"><input name="purchase_request_id" type="hidden" value={request.id} /><input name="item_id" type="hidden" value={item.id} /><input name="expected_version" type="hidden" value={request.version} /><button className="text-[11px] text-[var(--danger)] hover:underline" type="submit">Remover item</button></form>
                </div>
              ))}
            </div>
          ) : (
            <DataTable minWidth={760}>
              <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]"><tr><th className="px-1 py-3 font-medium">Descrição</th><th className="px-3 py-3 text-right font-medium">Quantidade</th><th className="px-3 py-3 font-medium">Unidade</th><th className="px-3 py-3 text-right font-medium">Preço unitário</th><th className="px-1 py-3 text-right font-medium">Total</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">{items.map((item) => <tr key={item.id}><td className="px-1 py-3 font-medium">{item.description}</td><td className="atlas-tabular px-3 py-3 text-right">{item.quantity}</td><td className="px-3 py-3 text-[var(--text-secondary)]">{item.unit}</td><td className="px-3 py-3 text-right"><Money currency={request.currency} value={item.estimatedUnitPrice} /></td><td className="px-1 py-3 text-right"><Money currency={request.currency} strong value={item.quantity * item.estimatedUnitPrice} /></td></tr>)}</tbody>
              <tfoot className="border-t border-[var(--border-strong)]"><tr><td className="px-1 py-3 text-right font-medium" colSpan={4}>Total estimado</td><td className="px-1 py-3 text-right"><Money currency={request.currency} strong value={request.estimatedTotal} /></td></tr></tfoot>
            </DataTable>
          )}
        </div>

        {editable ? (
          <form action={addPurchaseRequestItemAction} className="mt-4 grid gap-3 md:grid-cols-[2fr_0.7fr_0.7fr_1fr_auto]">
            <input name="purchase_request_id" type="hidden" value={request.id} /><input name="expected_version" type="hidden" value={request.version} />
            <label><span className={labelClass}>Novo item</span><input aria-label="Nova descrição" className={inputClass} name="description" placeholder="Descrição" /></label>
            <label><span className={labelClass}>Quantidade</span><input aria-label="Nova quantidade" className={inputClass} defaultValue="1" min="0.0001" name="quantity" step="0.0001" type="number" /></label>
            <label><span className={labelClass}>Unidade</span><input aria-label="Nova unidade" className={inputClass} defaultValue="un" name="unit" /></label>
            <label><span className={labelClass}>Preço estimado</span><input aria-label="Novo preço estimado" className={inputClass} defaultValue="0" min="0" name="estimated_unit_price" step="0.01" type="number" /></label>
            <button className="atlas-button self-end" type="submit">Adicionar item</button>
          </form>
        ) : null}
      </section>

      <section className="scroll-mt-6 border-t border-[var(--border)] pt-5" id="approvals">
        <SectionHeader title="Aprovações" />
        <div className="mt-4 max-w-2xl">
          <ApprovalTimeline steps={approvalSteps(request.status, request.submittedAt, decisions)} />
        </div>
        {request.status === 'financial_review' && settings ? <p className="mt-4 text-[11px] text-[var(--text-muted)]">Limite executivo: <Money currency={settings.currency} value={settings.executiveApprovalThreshold} />. Moeda diferente exige revisão executiva.</p> : null}
      </section>

      <div className="mt-5 space-y-5">
        <SourcingSummary requestId={request.id} permissions={access.permissions} />
      </div>

      <section className="scroll-mt-6 border-t border-[var(--border)] pt-5" id="activity">
        <SectionHeader title="Atividade" />
        <div className="mt-2">
          <ActivityList items={audit.map((entry) => ({
            text: entry.action,
            time: new Date(entry.createdAt).toLocaleString('pt-PT'),
          }))} />
        </div>
      </section>
    </main>
  )
}

function HeaderMeta({ label, value }: { label: string; value: ReactNode }) {
  return <div className="border-r border-[var(--border)] px-4 first:pl-0 last:border-r-0"><p className="text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</p><div className="mt-1.5 text-[13px]">{value}</div></div>
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return <div><p className="text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</p><div className="mt-1 text-[12px] text-[var(--text-secondary)]">{value}</div></div>
}

function CommandForm({ action, label, primary = false, requestId, version }: { action: (formData: FormData) => void | Promise<void>; label: string; primary?: boolean; requestId: string; version: number }) {
  return <form action={action}><input name="purchase_request_id" type="hidden" value={requestId} /><input name="expected_version" type="hidden" value={version} /><button className={`atlas-button ${primary ? 'atlas-button-primary' : ''}`} type="submit">{label}</button></form>
}

function DecisionForm({ approveAction, requestId, version }: { approveAction: (formData: FormData) => void | Promise<void>; requestId: string; version: number }) {
  return (
    <form className="flex flex-wrap items-center justify-end gap-2">
      <input name="purchase_request_id" type="hidden" value={requestId} />
      <input name="expected_version" type="hidden" value={version} />
      <input aria-label="Comentário da decisão" className={`${inputClass} w-56`} name="comment" placeholder="Comentário ou justificação" />
      <button className="atlas-button" formAction={returnPurchaseRequestAction} type="submit">Devolver</button>
      <button className="atlas-button atlas-button-danger" formAction={rejectPurchaseRequestAction} type="submit">Rejeitar</button>
      <button className="atlas-button atlas-button-primary" formAction={approveAction} type="submit">Aprovar</button>
    </form>
  )
}

function priorityLabel(priority: string) {
  return { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }[priority] ?? priority
}

function reviewLabel(status: PurchaseRequestStatus) {
  if (status === 'technical_review') return 'técnica'
  if (status === 'financial_review') return 'financeira'
  return 'executiva'
}

function approvalSteps(
  status: PurchaseRequestStatus,
  submittedAt: string | null,
  decisions: Array<{ stage: string; decision: string; decidedByName: string | null; comment: string | null; createdAt: string }>,
) {
  const stage = (name: string) => decisions.find((decision) => decision.stage.includes(name) && decision.decision === 'approved')
  const technical = stage('technical')
  const financial = stage('financial')
  const executive = stage('executive')
  const current = status.replace('_review', '')
  const step = (label: string, key: string, decision?: typeof technical) => ({
    label,
    state: decision ? 'complete' as const : current === key ? 'current' as const : 'pending' as const,
    detail: decision ? `${decision.decidedByName ?? 'Utilizador'} · Aprovada em ${new Date(decision.createdAt).toLocaleString('pt-PT')}` : current === key ? 'Pendente · Aguardando decisão' : 'Pendente',
    meta: decision?.comment ?? undefined,
  })
  return [
    {
      label: 'Solicitação submetida',
      state: submittedAt ? 'complete' as const : 'pending' as const,
      detail: submittedAt ? new Date(submittedAt).toLocaleString('pt-PT') : 'Ainda não submetida',
    },
    step('Revisão técnica', 'technical', technical),
    step('Revisão financeira', 'financial', financial),
    step('Revisão executiva', 'executive', executive),
  ]
}
