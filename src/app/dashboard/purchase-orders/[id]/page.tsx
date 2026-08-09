import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { z } from 'zod'

import {
  ActivityList,
  Breadcrumbs,
  DataTable,
  EntityLink,
  Money,
  PageHeader,
  SectionHeader,
  StatusBadge,
  Tabs,
} from '@/components/atlas/ui'
import { ListResourceDocuments } from '@/modules/documents/application/documents-use-cases'
import { DocumentSection } from '@/modules/documents/presentation/document-section'
import {
  GetPurchaseOrder,
  GetPurchaseOrderReceiptStatus,
  ListGoodsReceipts,
  ListPurchaseOrderAudit,
  ListPurchaseOrderItems,
} from '@/modules/procurement/application/fulfillment-use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { getProcurementError, getProcurementNotice } from '@/modules/procurement/presentation/feedback'

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

  const [items, receiptStatus, receipts, audit, query, orderDocuments] = await Promise.all([
    ListPurchaseOrderItems(id),
    GetPurchaseOrderReceiptStatus(id),
    access.can('Procurement.GoodsReceiptView') ? ListGoodsReceipts(id) : Promise.resolve([]),
    ListPurchaseOrderAudit(id),
    searchParams,
    ListResourceDocuments('purchase_order', id),
  ])
  const receiptDocuments = new Map(await Promise.all(receipts.map(async (receipt) => [receipt.id, await ListResourceDocuments('goods_receipt', receipt.id)] as const)))
  const error = getProcurementError(query.error)
  const notice = getProcurementNotice(query.notice)
  const receivable = access.can('Procurement.GoodsReceiptCreate') && ['issued', 'partially_received'].includes(order.status) && items.some((item) => item.remainingQuantity > 0)
  const returnTo = `/dashboard/purchase-orders/${order.id}`

  return (
    <main>
      <Breadcrumbs items={[{ label: 'Compras' }, { label: 'Ordens de compra', href: '/dashboard/purchase-orders' }, { label: order.orderNumber }]} />
      <div className="atlas-document-sheet atlas-document-sheet-header">
        <PageHeader
          actions={receivable ? <Link className="atlas-button atlas-button-primary" href={`/dashboard/purchase-orders/${order.id}/receipts/new`}>Registar receção</Link> : undefined}
          description={<><span className="font-medium text-[var(--text-primary)]">{order.supplierName}</span><span className="mt-1 block"><EntityLink href={`/dashboard/procurement/${order.purchaseRequestId}`}>{order.requestNumber}</EntityLink> — Aquisição operacional</span><span className="mt-1 block">Projeto: {order.projectName}</span></>}
          title={order.orderNumber}
        >
          <div className="grid grid-cols-2 gap-y-4 md:grid-cols-5">
            <HeaderMeta label="Valor total" value={<Money currency={order.currency} strong value={order.total} />} />
            <HeaderMeta label="Emitida em" value={new Date(order.issuedAt).toLocaleDateString('pt-PT')} />
            <HeaderMeta label="Emitida por" value={shortUser(order.issuedBy)} />
            <HeaderMeta label="Moeda" value={order.currency} />
            <HeaderMeta label="Estado" value={<StatusBadge label={orderStatus(order.status)} tone={order.status === 'received' ? 'success' : 'warning'} />} />
          </div>
        </PageHeader>
      </div>

      {error ? <div className="atlas-notice atlas-notice-error mt-4" role="alert">{error}</div> : null}
      {notice ? <div className="atlas-notice mt-4" role="status">{notice}</div> : null}

      <div className="mt-4"><Tabs items={[{ label: 'Visão geral', href: '#overview', active: true }, { label: 'Itens', href: '#items' }, { label: 'Receções', href: '#receipts' }, { label: 'Atividade', href: '#activity' }]} /></div>

      <section className="scroll-mt-6 py-5" id="overview">
        <SectionHeader title="Informação comercial" />
        <div className="atlas-document-summary mt-4 grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
          <Meta label="Fornecedor" value={order.supplierName} />
          <Meta label="Cotação" value={order.quotationNumber ?? order.quotationId} />
          <Meta label="Solicitação" value={<EntityLink href={`/dashboard/procurement/${order.purchaseRequestId}`}>{order.requestNumber}</EntityLink>} />
          <Meta label="Projeto" value={order.projectName} />
          <Meta label="Emitida por" value={shortUser(order.issuedBy)} />
          <Meta label="Emitida em" value={new Date(order.issuedAt).toLocaleString('pt-PT')} />
        </div>
      </section>

      <DocumentSection canUpload={access.can('Procurement.PurchaseOrderIssue')} documents={orderDocuments} resourceId={order.id} resourceType="purchase_order" returnTo={returnTo} title="Documento da ordem de compra" />

      <section className="scroll-mt-6 border-t border-[var(--border)] pt-5" id="items">
        <SectionHeader title="Itens da ordem" />
        <div className="mt-3">
          <DataTable minWidth={800} surface="paper">
            <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]"><tr><th className="px-2 py-3 font-medium">Descrição</th><th className="px-3 py-3 text-right font-medium">Quantidade</th><th className="px-3 py-3 font-medium">Unidade</th><th className="px-3 py-3 text-right font-medium">Preço unitário</th><th className="px-2 py-3 text-right font-medium">Total</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">{items.map((item) => <tr key={item.id}><td className="px-2 py-3 font-medium">{item.description}</td><td className="atlas-tabular px-3 py-3 text-right">{item.quantity}</td><td className="px-3 py-3 text-[var(--text-secondary)]">{item.unit}</td><td className="px-3 py-3 text-right"><Money currency={order.currency} value={item.unitPrice} /></td><td className="px-2 py-3 text-right"><Money currency={order.currency} strong value={item.total} /></td></tr>)}</tbody>
            <tfoot className="border-t border-[var(--border-strong)]"><MoneyRow label="Subtotal" value={order.subtotal} currency={order.currency} /><MoneyRow label="Impostos" value={order.taxAmount} currency={order.currency} /><MoneyRow label="Total" value={order.total} currency={order.currency} strong /></tfoot>
          </DataTable>
        </div>
      </section>

      <section className="mt-5 border-t border-[var(--border)] pt-5">
        <SectionHeader description={receiptStatus ? `Progresso de receção: ${receiptStatus.fullyReceivedItemCount}/${receiptStatus.itemCount} itens completos · ${receiptStatus.progressPercent}%` : undefined} title="Estado de receção" />
        <div className="mt-3">
          <DataTable minWidth={700} surface="paper">
            <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]"><tr><th className="px-2 py-3 font-medium">Item</th><th className="px-3 py-3 text-right font-medium">Encomendado</th><th className="px-3 py-3 text-right font-medium">Recebido</th><th className="px-2 py-3 text-right font-medium">Pendente</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">{items.map((item) => <tr key={item.id}><td className="px-2 py-3 font-medium">{item.description}</td><td className="atlas-tabular px-3 py-3 text-right">{item.quantity} {item.unit}</td><td className="atlas-tabular px-3 py-3 text-right">{item.quantityReceived} {item.unit}</td><td className="atlas-tabular px-2 py-3 text-right font-medium">{item.remainingQuantity} {item.unit}</td></tr>)}</tbody>
          </DataTable>
        </div>
      </section>

      <section className="scroll-mt-6 mt-5 border-t border-[var(--border)] pt-5" id="receipts">
        <SectionHeader action={receivable ? <Link className="atlas-link text-[12px]" href={`/dashboard/purchase-orders/${order.id}/receipts/new`}>Registar receção →</Link> : undefined} title="Receções registadas" />
        <div className="atlas-document-sheet mt-3 divide-y divide-[var(--paper-border)] px-3">
          {receipts.length === 0 ? <p className="py-5 text-[12px] text-[var(--text-muted)]">Nenhuma receção registada. Quando a mercadoria chegar, registe a primeira receção.</p> : receipts.map((receipt) => <a className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-5 py-3 text-[12px] hover:bg-[var(--surface-subtle)]" href={`#receipt-${receipt.id}`} id={`receipt-${receipt.id}`} key={receipt.id}><span className="atlas-link font-medium">{receipt.receiptNumber}</span><span className="atlas-tabular text-[var(--text-muted)]">{new Date(receipt.receivedAt).toLocaleString('pt-PT')}</span><StatusBadge label={receipt.status === 'complete' ? 'Completa' : 'Parcial'} tone={receipt.status === 'complete' ? 'success' : 'warning'} /><span aria-hidden>→</span></a>)}
        </div>
        {receivable ? <p className="mt-3 text-[11px] text-[var(--text-muted)]">Ainda existem materiais por receber.</p> : order.status === 'received' ? <p className="mt-3 text-[11px] text-[var(--success)]">Todos os itens foram recebidos. Ordem concluída.</p> : null}
      </section>

      {receipts.map((receipt) => (
        <DocumentSection canUpload={access.can('Procurement.GoodsReceiptCreate')} documents={receiptDocuments.get(receipt.id) ?? []} key={`receipt-doc-${receipt.id}`} resourceId={receipt.id} resourceType="goods_receipt" returnTo={returnTo} title={`Guia / comprovativo · ${receipt.receiptNumber}`} />
      ))}

      <section className="scroll-mt-6 mt-5 border-t border-[var(--border)] pt-5" id="activity">
        <SectionHeader title="Atividade" />
        <div className="atlas-document-summary mt-2"><ActivityList items={audit.map((entry) => ({ text: entry.action, time: new Date(entry.createdAt).toLocaleString('pt-PT') }))} /></div>
      </section>
    </main>
  )
}

function HeaderMeta({ label, value }: { label: string; value: ReactNode }) { return <div className="border-r border-[var(--border)] px-4 first:pl-0 last:border-r-0"><p className="text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</p><div className="mt-1.5 text-[12px]">{value}</div></div> }
function Meta({ label, value }: { label: string; value: ReactNode }) { return <div><p className="text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</p><div className="mt-1 text-[12px] text-[var(--text-secondary)]">{value}</div></div> }
function MoneyRow({ label, value, currency, strong = false }: { label: string; value: number; currency: string; strong?: boolean }) { return <tr><td className={`px-2 py-1.5 text-right ${strong ? 'font-medium' : 'text-[var(--text-secondary)]'}`} colSpan={4}>{label}</td><td className="px-2 py-1.5 text-right"><Money currency={currency} strong={strong} value={value} /></td></tr> }
function shortUser(id: string) { return `Utilizador ${id.slice(0, 8)}` }
function orderStatus(status: string) { return ({ issued: 'Emitida', partially_received: 'Parcialmente recebida', received: 'Recebida', cancelled: 'Cancelada', draft: 'Rascunho' } as Record<string, string>)[status] ?? status }
