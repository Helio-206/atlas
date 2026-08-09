import Link from 'next/link'
import type { ReactNode } from 'react'

import { EmptyState, EntityLink, Money, SectionHeader, StatusBadge } from '@/components/atlas/ui'

import {
  GetPurchaseOrderForPurchaseRequest,
  GetPurchaseOrderReceiptStatus,
  ListGoodsReceipts,
} from '../application/fulfillment-use-cases'
import { GetPurchaseRequest } from '../application/use-cases'
import {
  GetSupplierSelection,
  ListQuotationsForPurchaseRequest,
} from '../application/sourcing-use-cases'
import type { ProcurementPermission } from '../domain/permissions'
import { issuePurchaseOrderAction } from './fulfillment-actions'

export async function SourcingSummary({
  requestId,
  permissions,
}: {
  requestId: string
  permissions: ProcurementPermission[]
}) {
  if (!permissions.includes('Procurement.QuotationView')) return null

  const [quotations, selection, request] = await Promise.all([
    ListQuotationsForPurchaseRequest(requestId),
    GetSupplierSelection(requestId),
    GetPurchaseRequest.execute(requestId),
  ])
  const purchaseOrder = permissions.includes('Procurement.PurchaseOrderView')
    ? await GetPurchaseOrderForPurchaseRequest(requestId)
    : null
  const [receiptStatus, receipts] = purchaseOrder
    ? await Promise.all([
        GetPurchaseOrderReceiptStatus(purchaseOrder.id),
        permissions.includes('Procurement.GoodsReceiptView')
          ? ListGoodsReceipts(purchaseOrder.id)
          : Promise.resolve([]),
      ])
    : [null, []]

  return (
    <>
      <section className="scroll-mt-6 border-t border-[var(--border)] pt-5" id="quotations">
        <SectionHeader
          action={<Link className="atlas-link text-[12px]" href={`/dashboard/procurement/${requestId}/quotations`}>Abrir comparação →</Link>}
          title="Cotações"
        />
        {quotations.length === 0 ? (
          <EmptyState
            description="As cotações poderão ser adicionadas após a aprovação da solicitação."
            title="Nenhuma cotação registada."
          />
        ) : (
          <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {quotations.map((quotation) => (
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-5 py-3 text-[12px]" key={quotation.id}>
                <div>
                  <p className="font-medium">{quotation.supplierName}</p>
                  <p className="mt-0.5 text-[var(--text-muted)]">{quotation.quotationNumber ?? 'Sem número'}</p>
                </div>
                <Money currency={quotation.currency} value={quotation.total} />
                <StatusBadge label={quotation.status} tone={quotation.status === 'accepted' ? 'success' : 'neutral'} />
              </div>
            ))}
          </div>
        )}

        {selection ? (
          <div className="mt-4 border-l-2 border-[var(--success)] pl-4 text-[12px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--success)]">Selected Supplier</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <p className="font-medium">{selection.supplierName}</p>
              <Money currency={selection.currency} value={selection.total} />
              <p className="text-[var(--text-muted)]">Selecionado por {selection.selectedByName ?? 'utilizador'} em {new Date(selection.selectedAt).toLocaleString('pt-PT')}</p>
            </div>
            <p className="mt-2 text-[var(--text-secondary)]"><span className="text-[var(--text-muted)]">Justificação:</span> {selection.justification}</p>
          </div>
        ) : null}
      </section>

      <section className="scroll-mt-6 border-t border-[var(--border)] pt-5" id="purchase-order">
        <SectionHeader title="Ordem de compra" />
        {purchaseOrder ? (
          <div className="mt-3 grid grid-cols-2 gap-4 border-y border-[var(--border)] py-4 text-[12px] md:grid-cols-5">
            <Meta label="Ordem" value={<EntityLink href={`/dashboard/purchase-orders/${purchaseOrder.id}`}>{purchaseOrder.orderNumber}</EntityLink>} />
            <Meta label="Fornecedor" value={purchaseOrder.supplierName} />
            <Meta label="Valor" value={<Money currency={purchaseOrder.currency} value={purchaseOrder.total} />} />
            <Meta label="Estado" value={<StatusBadge label={purchaseOrder.status.replaceAll('_', ' ')} tone={purchaseOrder.status === 'received' ? 'success' : 'warning'} />} />
            <Meta label="Receção" value={receiptStatus ? `${receiptStatus.fullyReceivedItemCount}/${receiptStatus.itemCount} itens completos` : 'Sem dados'} />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-y border-[var(--border)] py-4">
            <p className="text-[12px] text-[var(--text-muted)]">Ainda não existe ordem de compra.</p>
            {selection && request?.status === 'supplier_selected' && permissions.includes('Procurement.PurchaseOrderIssue') ? (
              <form action={issuePurchaseOrderAction}>
                <input name="purchase_request_id" type="hidden" value={requestId} />
                <input name="expected_request_version" type="hidden" value={request.version} />
                <button className="atlas-button atlas-button-primary" type="submit">Emitir ordem de compra</button>
              </form>
            ) : null}
          </div>
        )}
      </section>

      <section className="scroll-mt-6 border-t border-[var(--border)] pt-5" id="receipts">
        <SectionHeader title="Receções" />
        {receipts.length === 0 ? (
          <p className="py-4 text-[12px] text-[var(--text-muted)]">Nenhuma receção registada.</p>
        ) : (
          <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {receipts.map((receipt) => (
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-5 py-3 text-[12px]" key={receipt.id}>
                <span className="font-medium">{receipt.receiptNumber}</span>
                <span className="atlas-tabular text-[var(--text-muted)]">{new Date(receipt.receivedAt).toLocaleString('pt-PT')}</span>
                <StatusBadge label={receipt.status} tone={receipt.status === 'complete' ? 'success' : 'warning'} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return <div><p className="text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</p><div className="mt-1 text-[12px] text-[var(--text-secondary)]">{value}</div></div>
}
