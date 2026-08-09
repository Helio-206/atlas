import Link from 'next/link'

import { Breadcrumbs, DataTable, Money, PageHeader, StatusBadge } from '@/components/atlas/ui'
import { ListPurchaseOrders } from '@/modules/procurement/application/fulfillment-use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'

export const dynamic = 'force-dynamic'

export default async function PurchaseOrdersPage() {
  const access = await requireProcurementAccess()
  if (!access.can('Procurement.PurchaseOrderView')) return <main><p className="atlas-notice">Sem permissão para consultar ordens de compra.</p></main>
  const orders = await ListPurchaseOrders()

  return (
    <main>
      <Breadcrumbs items={[{ label: 'Compras' }, { label: 'Ordens de compra' }]} />
      <div className="atlas-document-sheet atlas-document-sheet-header">
        <PageHeader description="Ordens emitidas a partir de fornecedores formalmente selecionados." title="Ordens de compra" />
      </div>
      <div className="mt-5">
        <DataTable minWidth={900} surface="paper">
          <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]"><tr><th className="px-2 py-3 font-medium">Ordem</th><th className="px-3 py-3 font-medium">Solicitação</th><th className="px-3 py-3 font-medium">Fornecedor</th><th className="px-3 py-3 font-medium">Projeto</th><th className="px-3 py-3 font-medium">Estado</th><th className="px-3 py-3 font-medium">Emitida</th><th className="px-2 py-3 text-right font-medium">Total</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">{orders.length === 0 ? <tr><td className="py-8 text-center text-[var(--text-muted)]" colSpan={7}>Ainda não existem ordens de compra.</td></tr> : orders.map((order) => <tr key={order.id}><td className="px-2 py-3"><Link className="atlas-link atlas-tabular font-medium" href={`/dashboard/purchase-orders/${order.id}`}>{order.orderNumber}</Link></td><td className="px-3 py-3"><Link className="atlas-link" href={`/dashboard/procurement/${order.purchaseRequestId}`}>{order.requestNumber}</Link></td><td className="px-3 py-3">{order.supplierName}</td><td className="px-3 py-3 text-[var(--text-secondary)]">{order.projectName}</td><td className="px-3 py-3"><StatusBadge label={order.status.replaceAll('_', ' ')} tone={order.status === 'received' ? 'success' : 'warning'} /></td><td className="atlas-tabular px-3 py-3 text-[var(--text-muted)]">{new Date(order.issuedAt).toLocaleString('pt-PT')}</td><td className="px-2 py-3 text-right"><Money currency={order.currency} strong value={order.total} /></td></tr>)}</tbody>
        </DataTable>
      </div>
    </main>
  )
}
