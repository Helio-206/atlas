import { notFound } from 'next/navigation'
import { z } from 'zod'

import { Breadcrumbs } from '@/components/atlas/ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  GetPurchaseOrder,
  ListGoodsReceipts,
  ListPurchaseOrderItems,
} from '@/modules/procurement/application/fulfillment-use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { GoodsReceiptForm } from '@/modules/procurement/presentation/goods-receipt-form'

export const dynamic = 'force-dynamic'

const idSchema = z.string().uuid()

export default async function NewGoodsReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireProcurementAccess()
  if (!access.can('Procurement.GoodsReceiptCreate')) notFound()
  const { id } = await params
  if (!idSchema.safeParse(id).success) notFound()

  const [order, items, receipts] = await Promise.all([
    GetPurchaseOrder(id),
    ListPurchaseOrderItems(id),
    access.can('Procurement.GoodsReceiptView') ? ListGoodsReceipts(id) : Promise.resolve([]),
  ])
  if (!order || !['issued', 'partially_received'].includes(order.status) || !items.some((item) => item.remainingQuantity > 0)) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase.schema('identity').from('profiles').select('full_name').maybeSingle()

  return (
    <main>
      <Breadcrumbs items={[{ label: 'Compras' }, { label: 'Ordens de compra', href: '/dashboard/purchase-orders' }, { label: order.orderNumber, href: `/dashboard/purchase-orders/${order.id}` }, { label: 'Registar receção' }]} />
      <GoodsReceiptForm
        items={items}
        order={order}
        previousReceiptCount={receipts.length}
        receiptDate={new Date().toISOString().slice(0, 10)}
        receivedBy={profile?.full_name ?? 'Utilizador atual'}
      />
    </main>
  )
}
