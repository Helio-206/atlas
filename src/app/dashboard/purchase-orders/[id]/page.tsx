import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'

import {
  GetPurchaseOrder,
  GetPurchaseOrderReceiptStatus,
  ListGoodsReceipts,
  ListPurchaseOrderAudit,
  ListPurchaseOrderItems,
} from '@/modules/procurement/application/fulfillment-use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { formatMoney, inputClass, labelClass } from '@/modules/procurement/presentation/components'
import { getProcurementError, getProcurementNotice } from '@/modules/procurement/presentation/feedback'
import { recordGoodsReceiptAction } from '@/modules/procurement/presentation/fulfillment-actions'

export const dynamic = 'force-dynamic'

const idSchema = z.string().uuid()

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>
}

export default async function PurchaseOrderPage({ params, searchParams }: Props) {
  const access = await requireProcurementAccess()
  if (!access.can('Procurement.PurchaseOrderView')) notFound()

  const { id } = await params
  if (!idSchema.safeParse(id).success) notFound()

  const order = await GetPurchaseOrder(id)
  if (!order) notFound()

  const [items, receiptStatus, receipts, audit] = await Promise.all([
    ListPurchaseOrderItems(id),
    GetPurchaseOrderReceiptStatus(id),
    access.can('Procurement.GoodsReceiptView') ? ListGoodsReceipts(id) : Promise.resolve([]),
    ListPurchaseOrderAudit(id),
  ])
  const query = await searchParams
  const error = getProcurementError(query.error)
  const notice = getProcurementNotice(query.notice)
  const receivable = access.can('Procurement.GoodsReceiptCreate') && ['issued', 'partially_received'].includes(order.status)

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-zinc-800 pb-8">
          <div>
            <Link className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300" href="/dashboard/purchase-orders">Purchase Orders</Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold">{order.orderNumber}</h1>
              <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs capitalize text-zinc-300">{order.status.replaceAll('_', ' ')}</span>
            </div>
            <p className="mt-2 text-sm text-zinc-400">Emitida em {new Date(order.issuedAt).toLocaleString('pt-PT')} · versão {order.version}</p>
          </div>
          <div className="text-right"><p className="text-xs uppercase tracking-wide text-zinc-500">Total</p><p className="mt-2 text-2xl font-semibold">{formatMoney(order.total, order.currency)}</p></div>
        </header>

        {error ? <div className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">{error}</div> : null}
        {notice ? <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300" role="status">{notice}</div> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Meta label="Supplier" value={order.supplierName} />
          <Meta label="Project" value={order.projectName} />
          <Meta label="Purchase Request" value={order.requestNumber} href={`/dashboard/procurement/${order.purchaseRequestId}`} />
          <Meta label="Quotation" value={order.quotationNumber ?? order.quotationId} />
        </div>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Items</h2><p className="mt-1 text-sm text-zinc-500">Commercial snapshot copied when the PO was issued.</p></div>{receiptStatus ? <p className="text-sm text-zinc-400">Receipt Progress: {receiptStatus.fullyReceivedItemCount}/{receiptStatus.itemCount} items · {receiptStatus.progressPercent}%</p> : null}</div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-3 py-3">Item</th><th className="px-3 py-3">Ordered</th><th className="px-3 py-3">Previously Received</th><th className="px-3 py-3">Remaining</th><th className="px-3 py-3 text-right">Unit Price</th><th className="px-3 py-3 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-zinc-800">{items.map((item) => <tr key={item.id}><td className="px-3 py-4">{item.description}</td><td className="px-3 py-4">{item.quantity} {item.unit}</td><td className="px-3 py-4">{item.quantityReceived} {item.unit}</td><td className="px-3 py-4 font-medium">{item.remainingQuantity} {item.unit}</td><td className="px-3 py-4 text-right">{formatMoney(item.unitPrice, order.currency)}</td><td className="px-3 py-4 text-right font-medium">{formatMoney(item.total, order.currency)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-2 border-t border-zinc-800 pt-5 text-sm md:ml-auto md:max-w-sm"><MoneyLine label="Subtotal" value={formatMoney(order.subtotal, order.currency)} /><MoneyLine label="Tax" value={formatMoney(order.taxAmount, order.currency)} /><MoneyLine label="Total" value={formatMoney(order.total, order.currency)} strong /></div>
        </section>

        {receivable && items.some((item) => item.remainingQuantity > 0) ? (
          <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Record Receipt</h2>
            <p className="mt-1 text-sm text-zinc-500">Registe apenas o que foi efetivamente recebido. Quantidades superiores ao restante são bloqueadas no formulário e na base de dados.</p>
            <form action={recordGoodsReceiptAction} className="mt-5">
              <input name="purchase_order_id" type="hidden" value={order.id} />
              <input name="expected_version" type="hidden" value={order.version} />
              <div className="space-y-3">{items.map((item) => (
                <div className="grid items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]" key={item.id}>
                  <div><p className="font-medium">{item.description}</p><p className="mt-1 text-xs text-zinc-500">{item.unit}</p></div>
                  <Metric label="Ordered" value={item.quantity} />
                  <Metric label="Previously Received" value={item.quantityReceived} />
                  <Metric label="Remaining" value={item.remainingQuantity} />
                  <label><span className={labelClass}>Receive Now</span><input aria-label={`Receive ${item.description}`} className={inputClass} disabled={item.remainingQuantity <= 0} max={item.remainingQuantity} min="0.0001" name={`receive_${item.id}`} step="0.0001" type="number" /></label>
                </div>
              ))}</div>
              <label className="mt-5 block"><span className={labelClass}>Notes</span><textarea className={`${inputClass} min-h-24`} maxLength={2000} name="notes" /></label>
              <button className="mt-5 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950" type="submit">Confirm Receipt</button>
            </form>
          </section>
        ) : null}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Goods Receipts</h2><span className="text-sm text-zinc-500">{receipts.length}</span></div>
          <div className="mt-5 space-y-3">{receipts.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma receção registada.</p> : receipts.map((receipt) => <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4" key={receipt.id}><div className="flex flex-wrap justify-between gap-3"><div><p className="font-mono font-medium">{receipt.receiptNumber}</p><p className="mt-1 text-xs text-zinc-500">{new Date(receipt.receivedAt).toLocaleString('pt-PT')}</p></div><span className="text-sm capitalize">{receipt.status}</span></div>{receipt.notes ? <p className="mt-3 text-sm text-zinc-400">{receipt.notes}</p> : null}</div>)}</div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Audit History</h2>
          <div className="mt-5 space-y-4">{audit.length === 0 ? <p className="text-sm text-zinc-500">Sem eventos.</p> : audit.map((entry, index) => <div className="border-l border-zinc-700 pl-4" key={`${entry.createdAt}-${index}`}><p className="text-sm font-medium">{entry.action}</p><p className="mt-1 text-xs text-zinc-500">{new Date(entry.createdAt).toLocaleString('pt-PT')}</p><p className="mt-2 break-all font-mono text-xs text-zinc-500">{JSON.stringify(entry.metadata)}</p></div>)}</div>
        </section>
      </section>
    </main>
  )
}

function Meta({ label, value, href }: { label: string; value: string; href?: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>{href ? <Link className="mt-2 block text-sm hover:underline" href={href}>{value}</Link> : <p className="mt-2 break-all text-sm">{value}</p>}</div>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-2 text-sm">{value}</p></div>
}

function MoneyLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex justify-between gap-4"><span className="text-zinc-500">{label}</span><span className={strong ? 'font-semibold text-zinc-100' : ''}>{value}</span></div>
}
