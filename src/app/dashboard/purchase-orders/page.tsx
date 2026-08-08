import Link from 'next/link'

import { ListPurchaseOrders } from '@/modules/procurement/application/fulfillment-use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { formatMoney } from '@/modules/procurement/presentation/components'

export const dynamic = 'force-dynamic'

export default async function PurchaseOrdersPage() {
  const access = await requireProcurementAccess()
  if (!access.can('Procurement.PurchaseOrderView')) {
    return <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100"><section className="mx-auto max-w-6xl"><p className="text-sm text-zinc-400">Sem permissão para consultar Purchase Orders.</p></section></main>
  }

  const orders = await ListPurchaseOrders()

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-8">
          <div>
            <Link className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300" href="/dashboard">Dashboard</Link>
            <h1 className="mt-3 text-2xl font-semibold">Purchase Orders</h1>
            <p className="mt-2 text-sm text-zinc-400">Ordens emitidas a partir de fornecedores formalmente selecionados.</p>
          </div>
        </header>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">PR</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Issued</th><th className="px-4 py-3 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {orders.length === 0 ? <tr><td className="px-4 py-8 text-zinc-500" colSpan={7}>Ainda não existem Purchase Orders.</td></tr> : orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-4"><Link className="font-mono font-semibold hover:underline" href={`/dashboard/purchase-orders/${order.id}`}>{order.orderNumber}</Link></td>
                  <td className="px-4 py-4"><Link className="text-zinc-300 hover:underline" href={`/dashboard/procurement/${order.purchaseRequestId}`}>{order.requestNumber}</Link></td>
                  <td className="px-4 py-4">{order.supplierName}</td>
                  <td className="px-4 py-4">{order.projectName}</td>
                  <td className="px-4 py-4 capitalize">{order.status.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-4 text-zinc-400">{new Date(order.issuedAt).toLocaleString('pt-PT')}</td>
                  <td className="px-4 py-4 text-right font-medium">{formatMoney(order.total, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
