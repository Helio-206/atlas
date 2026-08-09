import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import {
  Breadcrumbs,
  DataTable,
  Money,
  PageHeader,
  SectionHeader,
  StatusBadge,
} from '@/components/atlas/ui'
import { ListResourceDocuments } from '@/modules/documents/application/documents-use-cases'
import { DocumentSection } from '@/modules/documents/presentation/document-section'
import {
  GetPurchaseRequest,
  ListPurchaseRequestItems,
} from '@/modules/procurement/application/use-cases'
import {
  GetQuotationComparison,
  GetSupplierSelection,
  ListQuotationItems,
  ListSuppliers,
} from '@/modules/procurement/application/sourcing-use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { QuotationForm } from '@/modules/procurement/presentation/quotation-form'
import { submitQuotationAction } from '@/modules/procurement/presentation/sourcing-actions'
import { getSourcingError, getSourcingNotice } from '@/modules/procurement/presentation/sourcing-feedback'
import { SupplierSelectionPanel } from '@/modules/procurement/presentation/supplier-selection-panel'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>
}

export default async function QuotationsPage({ params, searchParams }: Props) {
  const access = await requireProcurementAccess()
  if (!access.can('Procurement.QuotationView')) return <main><p className="atlas-notice">Sem permissão para consultar cotações.</p></main>

  const { id } = await params
  const [request, items, comparison, selection, suppliers, query] = await Promise.all([
    GetPurchaseRequest.execute(id),
    ListPurchaseRequestItems.execute(id),
    GetQuotationComparison(id),
    GetSupplierSelection(id),
    access.can('Procurement.SupplierView') ? ListSuppliers() : Promise.resolve([]),
    searchParams,
  ])
  if (!request) notFound()

  const [quotationItems, quotationDocuments] = await Promise.all([
    Promise.all(comparison.quotations.map(async (quotation) => [quotation.id, await ListQuotationItems(quotation.id)] as const)),
    Promise.all(comparison.quotations.map(async (quotation) => [quotation.id, await ListResourceDocuments('quotation', quotation.id)] as const)),
  ])
  const itemMap = new Map(quotationItems)
  const documentMap = new Map(quotationDocuments)
  const error = getSourcingError(query.error)
  const notice = getSourcingNotice(query.notice)
  const canManageQuotation = access.can('Procurement.QuotationManage') && request.status === 'approved'
  const canUploadQuotationDocument = access.can('Procurement.QuotationManage')
  const canSelect = access.can('Procurement.SupplierSelect') && request.status === 'approved' && !selection
  const returnTo = `/dashboard/procurement/${request.id}/quotations`

  return (
    <main>
      <Breadcrumbs items={[
        { label: 'Compras' },
        { label: 'Solicitações', href: '/dashboard/procurement' },
        { label: request.requestNumber, href: `/dashboard/procurement/${request.id}` },
        { label: 'Cotações' },
      ]} />
      <PageHeader
        actions={<Link className="atlas-button" href={`/dashboard/procurement/${request.id}`}>Voltar à solicitação</Link>}
        description={<><span>{request.requestNumber} — {request.purpose}</span><span className="mt-1 block">Projeto: {request.projectName}</span></>}
        title="Comparação de fornecedores"
      />

      {error ? <div className="atlas-notice atlas-notice-error mt-4" role="alert">{error}</div> : null}
      {notice ? <div className="atlas-notice mt-4" role="status">{notice}</div> : null}

      <section aria-label="Contexto da solicitação" className="mt-4 grid grid-cols-2 border-y border-[var(--border)] md:grid-cols-5">
        <Context label="Valor estimado" value={<Money currency={request.currency} value={request.estimatedTotal} />} />
        <Context label="Itens" value={items.length} />
        <Context label="Cotações" value={comparison.quotations.length} />
        <Context label="Data necessária" value={new Date(`${request.requiredDate}T00:00:00`).toLocaleDateString('pt-PT')} />
        <Context label="Estado" value={<StatusBadge label="Aprovada" tone="success" />} />
      </section>

      <section className="mt-5">
        <SectionHeader title="Comparação de cotações" />
        <div className="mt-3 border-y border-[var(--border)]">
          <DataTable minWidth={900} surface="paper">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="w-[21%] px-3 py-3 text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">Critério</th>
                {comparison.quotations.map((quotation) => (
                  <th className="px-3 py-3 text-center font-medium" key={quotation.id}>
                    <span>{quotation.supplierName}</span>
                    <span className="mt-0.5 block text-[10px] font-normal text-[var(--text-muted)]">{quotation.quotationNumber ?? 'Sem número'}</span>
                    <span className="mt-1 block text-[10px] font-normal capitalize text-[var(--text-muted)]">{quotation.status}</span>
                    {canManageQuotation && quotation.status === 'draft' ? (
                      <form action={submitQuotationAction} className="mt-2">
                        <input name="purchase_request_id" type="hidden" value={request.id} />
                        <input name="quotation_id" type="hidden" value={quotation.id} />
                        <input name="expected_version" type="hidden" value={quotation.version} />
                        <button className="text-[10px] font-normal text-[var(--info)] hover:underline" type="submit">Submeter cotação</button>
                      </form>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              <ComparisonRow label="Preço total">{comparison.quotations.map((quotation) => <Cell key={quotation.id}><Money currency={quotation.currency} strong value={quotation.total} />{comparison.highlights.sameCurrency && comparison.highlights.lowestPriceId === quotation.id ? <Highlight>Menor preço</Highlight> : null}</Cell>)}</ComparisonRow>
              <ComparisonRow label="Prazo de entrega">{comparison.quotations.map((quotation) => <Cell key={quotation.id}>{quotation.deliveryDays === null ? '—' : `${quotation.deliveryDays} dias`}{comparison.highlights.fastestDeliveryId === quotation.id ? <Highlight>Entrega mais rápida</Highlight> : null}</Cell>)}</ComparisonRow>
              <ComparisonRow label="Cobertura">{comparison.quotations.map((quotation) => { const coverage = quotation.coveragePercent ?? 0; return <Cell key={quotation.id}>{coverage.toFixed(0)}%{coverage >= 100 ? <Highlight>Cobertura completa</Highlight> : <span className="mt-0.5 block text-[10px] text-[var(--danger)]">{Math.max(0, items.length - (quotation.coverageCount ?? 0))} item não cotado</span>}</Cell> })}</ComparisonRow>
              <ComparisonRow label="Validade">{comparison.quotations.map((quotation) => <Cell key={quotation.id}>{quotation.validUntil ? new Date(`${quotation.validUntil}T00:00:00`).toLocaleDateString('pt-PT') : '—'}</Cell>)}</ComparisonRow>
              <ComparisonRow label="Condições de pagamento">{comparison.quotations.map((quotation) => <Cell key={quotation.id}>{quotation.paymentTerms ?? '—'}</Cell>)}</ComparisonRow>
              <ComparisonRow label="Moeda">{comparison.quotations.map((quotation) => <Cell key={quotation.id}>{quotation.currency}</Cell>)}</ComparisonRow>
            </tbody>
          </DataTable>
          {comparison.quotations.length === 0 ? <p className="py-8 text-center text-[12px] text-[var(--text-muted)]">Ainda não existem cotações. Registe a primeira cotação para comparar fornecedores.</p> : null}
        </div>
        {!comparison.highlights.sameCurrency ? <p className="mt-2 border-l-2 border-[var(--warning)] pl-3 text-[11px] leading-5 text-[var(--text-secondary)]">As cotações estão em moedas diferentes e não podem ser comparadas diretamente sem taxa de câmbio.</p> : null}
      </section>

      {comparison.quotations.length ? (
        <section className="mt-5">
          <SectionHeader title="Comparação por item" />
          <div className="mt-3 border-y border-[var(--border)]">
            <DataTable minWidth={900} surface="paper">
              <thead className="border-b border-[var(--border)]"><tr><th className="px-2 py-3 text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">Item</th>{comparison.quotations.map((quotation) => <th className="px-3 py-3 text-center font-medium" key={quotation.id}>{quotation.supplierName}<span className="ml-1 text-[10px] font-normal text-[var(--text-muted)]">({quotation.currency})</span></th>)}</tr></thead>
              <tbody className="divide-y divide-[var(--border)]">{items.map((item) => <tr key={item.id}><td className="px-2 py-3 font-medium">{item.description}</td>{comparison.quotations.map((quotation) => { const quoted = itemMap.get(quotation.id)?.find((candidate) => candidate.purchaseRequestItemId === item.id); return <td className="px-3 py-3 text-center" key={quotation.id}>{quoted ? <Money currency={quotation.currency} value={quoted.unitPrice} /> : <span className="text-[var(--danger)]">Não cotado</span>}</td> })}</tr>)}</tbody>
            </DataTable>
          </div>
        </section>
      ) : null}

      {comparison.quotations.map((quotation) => (
        <DocumentSection
          canUpload={canUploadQuotationDocument}
          documents={documentMap.get(quotation.id) ?? []}
          key={`documents-${quotation.id}`}
          resourceId={quotation.id}
          resourceType="quotation"
          returnTo={returnTo}
          title={`Documento · ${quotation.supplierName} · ${quotation.quotationNumber ?? 'cotação'}`}
        />
      ))}

      {selection ? (
        <section className="mt-5 border-l-2 border-[var(--success)] pl-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--success)]">Selected Supplier</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px]"><strong>{selection.supplierName}</strong><Money currency={selection.currency} strong value={selection.total} /><span className="text-[var(--text-muted)]">Selecionado por {selection.selectedByName ?? 'utilizador'} em {new Date(selection.selectedAt).toLocaleString('pt-PT')}</span></div>
          <p className="mt-2 text-[12px] text-[var(--text-secondary)]"><span className="text-[var(--text-muted)]">Justificação:</span> {selection.justification}</p>
        </section>
      ) : canSelect ? (
        <div className="mt-5"><SupplierSelectionPanel purchaseRequestId={request.id} quotations={comparison.quotations.filter((quotation) => quotation.status === 'submitted').map((quotation) => ({ id: quotation.id, supplierName: quotation.supplierName, supplierStatus: quotation.supplierStatus, total: quotation.total, currency: quotation.currency, version: quotation.version }))} requestVersion={request.version} /></div>
      ) : null}

      {canManageQuotation ? (
        <details className="mt-6 border-t border-[var(--border)] pt-5">
          <summary className="cursor-pointer text-[13px] font-medium">Registar nova cotação</summary>
          <QuotationForm purchaseRequestId={request.id} requestItems={items.map((item) => ({ id: item.id, description: item.description, quantity: item.quantity, unit: item.unit }))} suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, status: supplier.status }))} />
        </details>
      ) : null}
    </main>
  )
}

function Context({ label, value }: { label: string; value: ReactNode }) { return <div className="border-r border-[var(--border)] px-5 py-4 last:border-r-0"><p className="text-[10px] text-[var(--text-muted)]">{label}</p><div className="mt-1 text-[13px] font-medium">{value}</div></div> }
function ComparisonRow({ label, children }: { label: string; children: ReactNode }) { return <tr><th className="px-3 py-3 font-normal text-[var(--text-secondary)]">{label}</th>{children}</tr> }
function Cell({ children }: { children: ReactNode }) { return <td className="px-3 py-3 text-center align-top">{children}</td> }
function Highlight({ children }: { children: ReactNode }) { return <span className="mt-0.5 block text-[10px] text-[var(--success)]">{children}</span> }
