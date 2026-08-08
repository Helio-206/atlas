import 'server-only'

import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import type { PurchaseRequestCurrency } from '../domain/purchase-request'
import type { GoodsReceiptStatus, PurchaseOrderStatus } from '../domain/fulfillment'
import { ProcurementRepositoryError } from './procurement-repository'

const purchaseOrderRowSchema = z.object({
  id: z.string().uuid(),
  purchase_request_id: z.string().uuid(),
  request_number: z.string(),
  project_id: z.string().uuid(),
  project_name: z.string(),
  supplier_id: z.string().uuid(),
  supplier_name: z.string(),
  quotation_id: z.string().uuid(),
  quotation_number: z.string().nullable(),
  order_number: z.string(),
  currency: z.string(),
  subtotal: z.coerce.number(),
  tax_amount: z.coerce.number(),
  total: z.coerce.number(),
  status: z.string(),
  issued_by: z.string().uuid(),
  issued_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.coerce.number().int(),
})

const purchaseOrderItemRowSchema = z.object({
  id: z.string().uuid(),
  purchase_request_item_id: z.string().uuid(),
  description: z.string(),
  quantity: z.coerce.number(),
  unit: z.string(),
  unit_price: z.coerce.number(),
  total: z.coerce.number(),
  quantity_received: z.coerce.number(),
  remaining_quantity: z.coerce.number(),
  created_at: z.string(),
})

const goodsReceiptRowSchema = z.object({
  id: z.string().uuid(),
  purchase_order_id: z.string().uuid(),
  receipt_number: z.string(),
  received_by: z.string().uuid(),
  received_at: z.string(),
  notes: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

const goodsReceiptItemRowSchema = z.object({
  id: z.string().uuid(),
  purchase_order_item_id: z.string().uuid(),
  description: z.string(),
  unit: z.string(),
  quantity_received: z.coerce.number(),
  created_at: z.string(),
})

const receiptStatusRowSchema = z.object({
  purchase_order_id: z.string().uuid(),
  status: z.string(),
  item_count: z.coerce.number().int(),
  fully_received_item_count: z.coerce.number().int(),
  receipt_count: z.coerce.number().int(),
  progress_percent: z.coerce.number(),
})

const auditRowSchema = z.object({
  action: z.string(),
  user_id: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
})

export type PurchaseOrderRecord = {
  id: string
  purchaseRequestId: string
  requestNumber: string
  projectId: string
  projectName: string
  supplierId: string
  supplierName: string
  quotationId: string
  quotationNumber: string | null
  orderNumber: string
  currency: PurchaseRequestCurrency
  subtotal: number
  taxAmount: number
  total: number
  status: PurchaseOrderStatus
  issuedBy: string
  issuedAt: string
  createdAt: string
  updatedAt: string
  version: number
}

export type PurchaseOrderItemRecord = {
  id: string
  purchaseRequestItemId: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  total: number
  quantityReceived: number
  remainingQuantity: number
  createdAt: string
}

export type GoodsReceiptRecord = {
  id: string
  purchaseOrderId: string
  receiptNumber: string
  receivedBy: string
  receivedAt: string
  notes: string | null
  status: GoodsReceiptStatus
  createdAt: string
}

export type GoodsReceiptItemRecord = {
  id: string
  purchaseOrderItemId: string
  description: string
  unit: string
  quantityReceived: number
  createdAt: string
}

export type PurchaseOrderReceiptStatusRecord = {
  purchaseOrderId: string
  status: PurchaseOrderStatus
  itemCount: number
  fullyReceivedItemCount: number
  receiptCount: number
  progressPercent: number
}

export type PurchaseOrderAuditRecord = {
  action: string
  userId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

function repositoryError(error: { message?: string; code?: string } | null) {
  if (!error) return
  throw new ProcurementRepositoryError([error.code, error.message].filter(Boolean).join(': '))
}

function mapPurchaseOrder(row: z.infer<typeof purchaseOrderRowSchema>): PurchaseOrderRecord {
  return {
    id: row.id,
    purchaseRequestId: row.purchase_request_id,
    requestNumber: row.request_number,
    projectId: row.project_id,
    projectName: row.project_name,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    quotationId: row.quotation_id,
    quotationNumber: row.quotation_number,
    orderNumber: row.order_number,
    currency: row.currency as PurchaseRequestCurrency,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    total: row.total,
    status: row.status as PurchaseOrderStatus,
    issuedBy: row.issued_by,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  }
}

export async function issuePurchaseOrderRepository(input: {
  purchaseRequestId: string
  expectedRequestVersion: number
}) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('issue_purchase_order', {
    purchase_request_id: input.purchaseRequestId,
    expected_request_version: input.expectedRequestVersion,
  })
  repositoryError(error)
  return z.string().uuid().parse(data)
}

export async function getPurchaseOrderRepository(purchaseOrderId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_purchase_order', { purchase_order_id: purchaseOrderId })
  repositoryError(error)
  const row = z.array(purchaseOrderRowSchema).parse(data ?? [])[0]
  return row ? mapPurchaseOrder(row) : null
}

export async function getPurchaseOrderForPurchaseRequestRepository(purchaseRequestId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_purchase_order_for_purchase_request', { purchase_request_id: purchaseRequestId })
  repositoryError(error)
  const row = z.array(purchaseOrderRowSchema).parse(data ?? [])[0]
  return row ? mapPurchaseOrder(row) : null
}

export async function listPurchaseOrdersRepository() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_purchase_orders')
  repositoryError(error)
  return z.array(purchaseOrderRowSchema).parse(data ?? []).map(mapPurchaseOrder)
}

export async function listPurchaseOrderItemsRepository(purchaseOrderId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_purchase_order_items', { purchase_order_id: purchaseOrderId })
  repositoryError(error)
  return z.array(purchaseOrderItemRowSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    purchaseRequestItemId: row.purchase_request_item_id,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    total: row.total,
    quantityReceived: row.quantity_received,
    remainingQuantity: row.remaining_quantity,
    createdAt: row.created_at,
  }))
}

export async function recordGoodsReceiptRepository(input: {
  purchaseOrderId: string
  expectedVersion: number
  notes: string | null
  items: Array<{ purchaseOrderItemId: string; quantityReceived: number }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('record_goods_receipt', {
    purchase_order_id: input.purchaseOrderId,
    expected_version: input.expectedVersion,
    notes: input.notes,
    items: input.items,
  })
  repositoryError(error)
  return z.string().uuid().parse(data)
}

export async function getGoodsReceiptRepository(goodsReceiptId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_goods_receipt', { goods_receipt_id: goodsReceiptId })
  repositoryError(error)
  const row = z.array(goodsReceiptRowSchema).parse(data ?? [])[0]
  if (!row) return null
  return {
    id: row.id,
    purchaseOrderId: row.purchase_order_id,
    receiptNumber: row.receipt_number,
    receivedBy: row.received_by,
    receivedAt: row.received_at,
    notes: row.notes,
    status: row.status as GoodsReceiptStatus,
    createdAt: row.created_at,
  } satisfies GoodsReceiptRecord
}

export async function listGoodsReceiptsRepository(purchaseOrderId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_goods_receipts', { purchase_order_id: purchaseOrderId })
  repositoryError(error)
  return z.array(goodsReceiptRowSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    purchaseOrderId: row.purchase_order_id,
    receiptNumber: row.receipt_number,
    receivedBy: row.received_by,
    receivedAt: row.received_at,
    notes: row.notes,
    status: row.status as GoodsReceiptStatus,
    createdAt: row.created_at,
  } satisfies GoodsReceiptRecord))
}

export async function listGoodsReceiptItemsRepository(goodsReceiptId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_goods_receipt_items', { goods_receipt_id: goodsReceiptId })
  repositoryError(error)
  return z.array(goodsReceiptItemRowSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    purchaseOrderItemId: row.purchase_order_item_id,
    description: row.description,
    unit: row.unit,
    quantityReceived: row.quantity_received,
    createdAt: row.created_at,
  } satisfies GoodsReceiptItemRecord))
}

export async function getPurchaseOrderReceiptStatusRepository(purchaseOrderId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_purchase_order_receipt_status', { purchase_order_id: purchaseOrderId })
  repositoryError(error)
  const row = z.array(receiptStatusRowSchema).parse(data ?? [])[0]
  if (!row) return null
  return {
    purchaseOrderId: row.purchase_order_id,
    status: row.status as PurchaseOrderStatus,
    itemCount: row.item_count,
    fullyReceivedItemCount: row.fully_received_item_count,
    receiptCount: row.receipt_count,
    progressPercent: row.progress_percent,
  } satisfies PurchaseOrderReceiptStatusRecord
}

export async function listPurchaseOrderAuditRepository(purchaseOrderId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_purchase_order_audit', { purchase_order_id: purchaseOrderId })
  repositoryError(error)
  return z.array(auditRowSchema).parse(data ?? []).map((row) => ({
    action: row.action,
    userId: row.user_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  } satisfies PurchaseOrderAuditRecord))
}
