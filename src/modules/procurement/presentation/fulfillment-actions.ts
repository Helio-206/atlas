'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { IssuePurchaseOrder, RecordGoodsReceipt } from '../application/fulfillment-use-cases'
import { issuePurchaseOrderSchema, recordGoodsReceiptSchema } from '../contracts/fulfillment-schemas'
import { ProcurementRepositoryError } from '../infrastructure/procurement-repository'

function formValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function errorCode(error: unknown) {
  const message = error instanceof ProcurementRepositoryError ? error.message : ''
  if (message.includes('permission_denied')) return 'permission_denied'
  if (message.includes('version_conflict')) return 'version_conflict'
  if (message.includes('supplier_selected_purchase_request_required')) return 'invalid_order_request_status'
  if (message.includes('supplier_selection_not_found')) return 'supplier_selection_missing'
  if (message.includes('selected_quotation_mismatch') || message.includes('accepted_quotation_required')) return 'selected_quotation_invalid'
  if (message.includes('supplier_blocked')) return 'supplier_blocked'
  if (message.includes('purchase_order_already_exists')) return 'purchase_order_exists'
  if (message.includes('purchase_order_not_receivable') || message.includes('purchase_request_receipt_state_invalid')) return 'purchase_order_not_receivable'
  if (message.includes('goods_receipt_over_quantity')) return 'over_receipt'
  if (message.includes('invalid_goods_receipt_quantity') || message.includes('goods_receipt_items_required')) return 'receipt_quantity_required'
  if (message.includes('not_found')) return 'not_found'
  return 'command_failed'
}

function revalidateFulfillment(requestId?: string, purchaseOrderId?: string) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/procurement')
  revalidatePath('/dashboard/purchase-orders')
  if (requestId) revalidatePath(`/dashboard/procurement/${requestId}`)
  if (purchaseOrderId) revalidatePath(`/dashboard/purchase-orders/${purchaseOrderId}`)
}

export async function issuePurchaseOrderAction(formData: FormData) {
  const requestId = formValue(formData, 'purchase_request_id')
  const parsed = issuePurchaseOrderSchema.safeParse({
    purchaseRequestId: requestId,
    expectedRequestVersion: formValue(formData, 'expected_request_version'),
  })
  if (!parsed.success) redirect(`/dashboard/procurement/${requestId}?error=invalid_form`)

  let purchaseOrderId: string
  try {
    purchaseOrderId = await IssuePurchaseOrder(parsed.data)
  } catch (error) {
    redirect(`/dashboard/procurement/${requestId}?error=${errorCode(error)}`)
  }

  revalidateFulfillment(requestId, purchaseOrderId)
  redirect(`/dashboard/purchase-orders/${purchaseOrderId}?notice=purchase_order_issued`)
}

export async function recordGoodsReceiptAction(formData: FormData) {
  const purchaseOrderId = formValue(formData, 'purchase_order_id')
  const rawItems = Array.from(formData.entries())
    .filter(([key, value]) => key.startsWith('receive_') && typeof value === 'string' && value.trim() !== '' && Number(value) > 0)
    .map(([key, value]) => ({
      purchaseOrderItemId: key.slice('receive_'.length),
      quantityReceived: value,
    }))

  const parsed = recordGoodsReceiptSchema.safeParse({
    purchaseOrderId,
    expectedVersion: formValue(formData, 'expected_version'),
    notes: formValue(formData, 'notes'),
    items: rawItems,
  })
  if (!parsed.success) redirect(`/dashboard/purchase-orders/${purchaseOrderId}?error=receipt_quantity_required`)

  try {
    await RecordGoodsReceipt(parsed.data)
  } catch (error) {
    redirect(`/dashboard/purchase-orders/${purchaseOrderId}?error=${errorCode(error)}`)
  }

  revalidateFulfillment(undefined, purchaseOrderId)
  redirect(`/dashboard/purchase-orders/${purchaseOrderId}?notice=goods_receipt_recorded`)
}
