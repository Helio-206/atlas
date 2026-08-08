import { describe, expect, it } from 'vitest'

import {
  assertPurchaseOrderIssue,
  createCommercialSnapshot,
  evaluateReceipt,
  FulfillmentDomainError,
} from './fulfillment'

const issueBase = {
  requestStatus: 'supplier_selected',
  selectedSupplierId: 'supplier-a',
  selectedQuotationId: 'quotation-a',
  supplierId: 'supplier-a',
  quotationId: 'quotation-a',
  hasActivePurchaseOrder: false,
  expectedRequestVersion: 7,
  currentRequestVersion: 7,
}

const receiptItems = [
  { id: 'cement', ordered: 100, previouslyReceived: 0 },
  { id: 'steel', ordered: 50, previouslyReceived: 0 },
]

describe('purchase order issue rules', () => {
  it('rejects a purchase order for an invalid purchase request status', () => {
    expect(() => assertPurchaseOrderIssue({ ...issueBase, requestStatus: 'approved' })).toThrow(
      'supplier_selected_purchase_request_required',
    )
  })

  it('rejects a supplier different from the formal selection', () => {
    expect(() => assertPurchaseOrderIssue({ ...issueBase, supplierId: 'supplier-b' })).toThrow(
      'selected_supplier_mismatch',
    )
  })

  it('rejects a quotation different from the formal selection', () => {
    expect(() => assertPurchaseOrderIssue({ ...issueBase, quotationId: 'quotation-b' })).toThrow(
      'selected_quotation_mismatch',
    )
  })

  it('rejects a duplicate active purchase order', () => {
    expect(() => assertPurchaseOrderIssue({ ...issueBase, hasActivePurchaseOrder: true })).toThrow(
      'purchase_order_already_exists',
    )
  })

  it('rejects a stale purchase request version', () => {
    expect(() => assertPurchaseOrderIssue({ ...issueBase, expectedRequestVersion: 6 })).toThrow(
      'purchase_request_version_conflict',
    )
  })

  it('preserves a commercial item snapshot independently of the quotation source', () => {
    const source = [{ purchaseRequestItemId: 'item-1', description: 'Cement', quantity: 10, unit: 'bag', unitPrice: 50 }]
    const snapshot = createCommercialSnapshot(source)
    source[0].description = 'Changed later'
    source[0].unitPrice = 999
    expect(snapshot[0]).toEqual({ purchaseRequestItemId: 'item-1', description: 'Cement', quantity: 10, unit: 'bag', unitPrice: 50 })
  })
})

describe('goods receipt rules', () => {
  it('creates a partial receipt while quantities remain', () => {
    expect(evaluateReceipt({ purchaseOrderStatus: 'issued', expectedVersion: 1, currentVersion: 1, items: receiptItems, receiveNow: [{ purchaseOrderItemId: 'cement', quantityReceived: 80 }] })).toMatchObject({ receiptStatus: 'partial', purchaseOrderStatus: 'partially_received', purchaseRequestStatus: 'partially_received', nextVersion: 2 })
  })

  it('closes the order and request when every item is fully received', () => {
    const result = evaluateReceipt({
      purchaseOrderStatus: 'partially_received',
      expectedVersion: 2,
      currentVersion: 2,
      items: [
        { id: 'cement', ordered: 100, previouslyReceived: 80 },
        { id: 'steel', ordered: 50, previouslyReceived: 50 },
      ],
      receiveNow: [{ purchaseOrderItemId: 'cement', quantityReceived: 20 }],
    })
    expect(result).toMatchObject({ receiptStatus: 'complete', purchaseOrderStatus: 'received', purchaseRequestStatus: 'received', nextVersion: 3 })
  })

  it('rejects over-receipt', () => {
    expect(() => evaluateReceipt({ purchaseOrderStatus: 'issued', expectedVersion: 1, currentVersion: 1, items: receiptItems, receiveNow: [{ purchaseOrderItemId: 'cement', quantityReceived: 101 }] })).toThrow('goods_receipt_over_quantity')
  })

  it('rejects zero quantity', () => {
    expect(() => evaluateReceipt({ purchaseOrderStatus: 'issued', expectedVersion: 1, currentVersion: 1, items: receiptItems, receiveNow: [{ purchaseOrderItemId: 'cement', quantityReceived: 0 }] })).toThrow('invalid_goods_receipt_quantity')
  })

  it('rejects an empty receipt', () => {
    expect(() => evaluateReceipt({ purchaseOrderStatus: 'issued', expectedVersion: 1, currentVersion: 1, items: receiptItems, receiveNow: [] })).toThrow('goods_receipt_items_required')
  })

  it('rejects receipts for a non-receivable purchase order', () => {
    expect(() => evaluateReceipt({ purchaseOrderStatus: 'received', expectedVersion: 3, currentVersion: 3, items: receiptItems, receiveNow: [{ purchaseOrderItemId: 'cement', quantityReceived: 1 }] })).toThrow('purchase_order_not_receivable')
  })

  it('rejects stale purchase order concurrency tokens', () => {
    expect(() => evaluateReceipt({ purchaseOrderStatus: 'partially_received', expectedVersion: 1, currentVersion: 2, items: receiptItems, receiveNow: [{ purchaseOrderItemId: 'cement', quantityReceived: 1 }] })).toThrow(FulfillmentDomainError)
    expect(() => evaluateReceipt({ purchaseOrderStatus: 'partially_received', expectedVersion: 1, currentVersion: 2, items: receiptItems, receiveNow: [{ purchaseOrderItemId: 'cement', quantityReceived: 1 }] })).toThrow('purchase_order_version_conflict')
  })
})
