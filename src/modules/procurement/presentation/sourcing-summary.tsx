import Link from 'next/link'

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
import { formatMoney } from './components'

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
  const suppliers = [...new Set(quotations.map((quotation) => quotation.supplierName))]
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

  const firstPartial = receipts.find((receipt) => receipt.status === 'partial')
  const completedReceipt = receipts.find((receipt) => receipt.status === 'complete')
  const timeline = [
    { label: 'Requested', date: request?.createdAt ?? null },
    { label: 'Approved', date: request?.approvedAt ?? null },
    { label: 'Supplier Selected', date: selection?.selectedAt ?? null },
    { label: 'Purchase Order Issued', date: purchaseOrder?.issuedAt ?? null },
    { label: 'Partially Received', date: firstPartial?.receivedAt ?? null },
    { label: 'Received', date: completedReceipt?.receivedAt ?? null },
  ]

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Quotations</p>
          <h2 className="mt-2 text-lg font-semibold">Sourcing</h2>
          <p className="mt-1 text-sm text-zinc-400">{quotations.length} cotação(ões) · {suppliers.length} fornecedor(es) participante(s)</p>
        </div>
        <Link className="rounded-lg border border-zinc-700 px-4 py-2 text-sm" href={`/dashboard/procurement/${requestId}/quotations`}>Abrir comparação</Link>
      </div>

      {quotations.length ? <div className="mt-4 flex flex-wrap gap-2">{quotations.map((quotation) => <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300" key={quotation.id}>{quotation.supplierName} · {quotation.status}</span>)}</div> : null}

      {selection ? (
        <div className="mt-6 border-t border-zinc-800 pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Selected Supplier</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3"><div><p className="text-xs text-zinc-500">Supplier</p><p className="mt-1 font-medium">{selection.supplierName}</p></div><div><p className="text-xs text-zinc-500">Quotation</p><p className="mt-1">{selection.quotationNumber ?? 'Sem número'} · {formatMoney(selection.total, selection.currency)}</p></div><div><p className="text-xs text-zinc-500">Selected By / Date</p><p className="mt-1 text-sm">{selection.selectedByName ?? selection.selectedBy} · {new Date(selection.selectedAt).toLocaleString('pt-PT')}</p></div></div>
          <p className="mt-4 text-sm text-zinc-300"><span className="text-zinc-500">Justification:</span> {selection.justification}</p>

          {!purchaseOrder && request?.status === 'supplier_selected' && permissions.includes('Procurement.PurchaseOrderIssue') ? (
            <form action={issuePurchaseOrderAction} className="mt-5">
              <input name="purchase_request_id" type="hidden" value={requestId} />
              <input name="expected_request_version" type="hidden" value={request.version} />
              <button className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950" type="submit">Issue Purchase Order</button>
            </form>
          ) : null}
        </div>
      ) : null}

      {purchaseOrder ? (
        <div className="mt-6 border-t border-zinc-800 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Purchase Order</p>
              <p className="mt-2 font-mono font-semibold">{purchaseOrder.orderNumber}</p>
              <p className="mt-1 text-sm text-zinc-400">{purchaseOrder.status} · {formatMoney(purchaseOrder.total, purchaseOrder.currency)}</p>
            </div>
            <Link className="rounded-lg border border-zinc-700 px-4 py-2 text-sm" href={`/dashboard/purchase-orders/${purchaseOrder.id}`}>Abrir Purchase Order</Link>
          </div>
          {receiptStatus ? <p className="mt-4 text-sm text-zinc-400">Receipt Progress: {receiptStatus.fullyReceivedItemCount}/{receiptStatus.itemCount} items completos · {receiptStatus.progressPercent}%</p> : null}
        </div>
      ) : null}

      <div className="mt-6 border-t border-zinc-800 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Procurement Timeline</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {timeline.map((step) => <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3" key={step.label}><p className="text-sm font-medium">{step.label}</p><p className="mt-1 text-xs text-zinc-500">{step.date ? new Date(step.date).toLocaleString('pt-PT') : 'Pendente'}</p></div>)}
        </div>
      </div>
    </section>
  )
}
