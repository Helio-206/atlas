export const purchaseOrderStatuses = [
  'draft',
  'issued',
  'partially_received',
  'received',
  'cancelled',
] as const

export const goodsReceiptStatuses = ['partial', 'complete'] as const

export type PurchaseOrderStatus = (typeof purchaseOrderStatuses)[number]
export type GoodsReceiptStatus = (typeof goodsReceiptStatuses)[number]

export class FulfillmentDomainError extends Error {}

export type CommercialSnapshotItem = {
  purchaseRequestItemId: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
}

export function assertPurchaseOrderIssue(input: {
  requestStatus: string
  selectedSupplierId: string
  selectedQuotationId: string
  supplierId: string
  quotationId: string
  hasActivePurchaseOrder: boolean
  expectedRequestVersion: number
  currentRequestVersion: number
}) {
  if (input.expectedRequestVersion !== input.currentRequestVersion) {
    throw new FulfillmentDomainError('purchase_request_version_conflict')
  }
  if (input.requestStatus !== 'supplier_selected') {
    throw new FulfillmentDomainError('supplier_selected_purchase_request_required')
  }
  if (input.supplierId !== input.selectedSupplierId) {
    throw new FulfillmentDomainError('selected_supplier_mismatch')
  }
  if (input.quotationId !== input.selectedQuotationId) {
    throw new FulfillmentDomainError('selected_quotation_mismatch')
  }
  if (input.hasActivePurchaseOrder) {
    throw new FulfillmentDomainError('purchase_order_already_exists')
  }
}

export function createCommercialSnapshot(items: CommercialSnapshotItem[]) {
  return items.map((item) => ({ ...item }))
}

export type ReceiptProgressItem = {
  id: string
  ordered: number
  previouslyReceived: number
}

export type ReceiptInputItem = {
  purchaseOrderItemId: string
  quantityReceived: number
}

export function evaluateReceipt(input: {
  purchaseOrderStatus: PurchaseOrderStatus
  expectedVersion: number
  currentVersion: number
  items: ReceiptProgressItem[]
  receiveNow: ReceiptInputItem[]
}) {
  if (input.expectedVersion !== input.currentVersion) {
    throw new FulfillmentDomainError('purchase_order_version_conflict')
  }
  if (!['issued', 'partially_received'].includes(input.purchaseOrderStatus)) {
    throw new FulfillmentDomainError('purchase_order_not_receivable')
  }
  if (input.receiveNow.length === 0) {
    throw new FulfillmentDomainError('goods_receipt_items_required')
  }

  const receivedNow = new Map<string, number>()
  for (const receiptItem of input.receiveNow) {
    if (receiptItem.quantityReceived <= 0) {
      throw new FulfillmentDomainError('invalid_goods_receipt_quantity')
    }
    const orderItem = input.items.find((item) => item.id === receiptItem.purchaseOrderItemId)
    if (!orderItem) {
      throw new FulfillmentDomainError('purchase_order_item_not_found')
    }
    const priorInReceipt = receivedNow.get(receiptItem.purchaseOrderItemId) ?? 0
    const next = priorInReceipt + receiptItem.quantityReceived
    const remaining = orderItem.ordered - orderItem.previouslyReceived
    if (next > remaining) {
      throw new FulfillmentDomainError('goods_receipt_over_quantity')
    }
    receivedNow.set(receiptItem.purchaseOrderItemId, next)
  }

  const complete = input.items.every((item) =>
    item.previouslyReceived + (receivedNow.get(item.id) ?? 0) >= item.ordered,
  )

  return {
    receiptStatus: complete ? ('complete' as const) : ('partial' as const),
    purchaseOrderStatus: complete ? ('received' as const) : ('partially_received' as const),
    purchaseRequestStatus: complete ? ('received' as const) : ('partially_received' as const),
    nextVersion: input.currentVersion + 1,
  }
}
