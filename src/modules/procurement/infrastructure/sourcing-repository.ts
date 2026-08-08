import 'server-only'

import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import type { PurchaseRequestCurrency } from '../domain/purchase-request'
import type { QuotationStatus, SupplierStatus } from '../domain/sourcing'
import { ProcurementRepositoryError } from './procurement-repository'

const supplierRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tax_number: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  status: z.string(),
  created_by: z.string().uuid().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.coerce.number().int(),
})

const quotationRowSchema = z.object({
  id: z.string().uuid(),
  purchase_request_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid(),
  supplier_name: z.string(),
  supplier_status: z.string(),
  quotation_number: z.string().nullable(),
  currency: z.string(),
  subtotal: z.coerce.number(),
  tax_amount: z.coerce.number(),
  total: z.coerce.number(),
  valid_until: z.string().nullable(),
  delivery_days: z.coerce.number().int().nullable(),
  payment_terms: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.string(),
  coverage_count: z.coerce.number().int().optional(),
  request_item_count: z.coerce.number().int().optional(),
  coverage_percent: z.coerce.number().optional(),
  created_by: z.string().uuid().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.coerce.number().int(),
})

const quotationItemRowSchema = z.object({
  id: z.string().uuid(),
  purchase_request_item_id: z.string().uuid(),
  description: z.string(),
  quantity: z.coerce.number(),
  unit: z.string(),
  unit_price: z.coerce.number(),
  total: z.coerce.number(),
  created_at: z.string(),
})

const selectionRowSchema = z.object({
  id: z.string().uuid(),
  quotation_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  supplier_name: z.string(),
  quotation_number: z.string().nullable(),
  currency: z.string(),
  total: z.coerce.number(),
  justification: z.string(),
  selected_by: z.string().uuid(),
  selected_by_name: z.string().nullable(),
  selected_at: z.string(),
})

export type SupplierRecord = {
  id: string
  name: string
  taxNumber: string | null
  email: string | null
  phone: string | null
  address: string | null
  status: SupplierStatus
  createdBy?: string
  createdAt: string
  updatedAt: string
  version: number
}

export type QuotationRecord = {
  id: string
  purchaseRequestId?: string
  supplierId: string
  supplierName: string
  supplierStatus: SupplierStatus
  quotationNumber: string | null
  currency: PurchaseRequestCurrency
  subtotal: number
  taxAmount: number
  total: number
  validUntil: string | null
  deliveryDays: number | null
  paymentTerms: string | null
  notes: string | null
  status: QuotationStatus
  coverageCount?: number
  requestItemCount?: number
  coveragePercent?: number
  createdBy?: string
  createdAt: string
  updatedAt: string
  version: number
}

export type QuotationItemRecord = {
  id: string
  purchaseRequestItemId: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  total: number
  createdAt: string
}

export type SupplierSelectionRecord = {
  id: string
  quotationId: string
  supplierId: string
  supplierName: string
  quotationNumber: string | null
  currency: PurchaseRequestCurrency
  total: number
  justification: string
  selectedBy: string
  selectedByName: string | null
  selectedAt: string
}

function repositoryError(error: { message?: string; code?: string } | null) {
  if (!error) return
  throw new ProcurementRepositoryError(
    [error.code, error.message].filter(Boolean).join(': '),
  )
}

function mapSupplier(row: z.infer<typeof supplierRowSchema>): SupplierRecord {
  return {
    id: row.id,
    name: row.name,
    taxNumber: row.tax_number,
    email: row.email,
    phone: row.phone,
    address: row.address,
    status: row.status as SupplierStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  }
}

function mapQuotation(row: z.infer<typeof quotationRowSchema>): QuotationRecord {
  return {
    id: row.id,
    purchaseRequestId: row.purchase_request_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    supplierStatus: row.supplier_status as SupplierStatus,
    quotationNumber: row.quotation_number,
    currency: row.currency as PurchaseRequestCurrency,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    total: row.total,
    validUntil: row.valid_until,
    deliveryDays: row.delivery_days,
    paymentTerms: row.payment_terms,
    notes: row.notes,
    status: row.status as QuotationStatus,
    coverageCount: row.coverage_count,
    requestItemCount: row.request_item_count,
    coveragePercent: row.coverage_percent,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  }
}

async function rpcVersion(name: string, args: Record<string, unknown>) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc(name, args)
  repositoryError(error)
  return z.coerce.number().int().min(1).parse(data)
}

export async function createSupplierRepository(input: {
  name: string
  taxNumber: string | null
  email: string | null
  phone: string | null
  address: string | null
}) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('create_supplier', {
    name: input.name,
    tax_number: input.taxNumber,
    email: input.email,
    phone: input.phone,
    address: input.address,
  })
  repositoryError(error)
  return z.string().uuid().parse(data)
}

export function updateSupplierRepository(input: {
  supplierId: string
  expectedVersion: number
  name: string
  taxNumber: string | null
  email: string | null
  phone: string | null
  address: string | null
}) {
  return rpcVersion('update_supplier', {
    supplier_id: input.supplierId,
    expected_version: input.expectedVersion,
    name: input.name,
    tax_number: input.taxNumber,
    email: input.email,
    phone: input.phone,
    address: input.address,
  })
}

export function setSupplierStatusRepository(
  command: 'activate_supplier' | 'deactivate_supplier' | 'block_supplier',
  input: { supplierId: string; expectedVersion: number },
) {
  return rpcVersion(command, {
    supplier_id: input.supplierId,
    expected_version: input.expectedVersion,
  })
}

export async function listSuppliersRepository(input: {
  status?: string | null
  search?: string | null
} = {}) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_suppliers', {
    status_filter: input.status ?? null,
    search_filter: input.search ?? null,
  })
  repositoryError(error)
  return z.array(supplierRowSchema).parse(data ?? []).map(mapSupplier)
}

export async function getSupplierRepository(supplierId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_supplier', { supplier_id: supplierId })
  repositoryError(error)
  const row = z.array(supplierRowSchema).parse(data ?? [])[0]
  return row ? mapSupplier(row) : null
}

export async function createQuotationRepository(input: {
  purchaseRequestId: string
  supplierId: string
  quotationNumber: string | null
  currency: PurchaseRequestCurrency
  taxAmount: number
  validUntil: string | null
  deliveryDays: number | null
  paymentTerms: string | null
  notes: string | null
  items: Array<{
    purchaseRequestItemId: string
    description: string
    quantity: number
    unit: string
    unitPrice: number
  }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('create_quotation', {
    purchase_request_id: input.purchaseRequestId,
    supplier_id: input.supplierId,
    quotation_number: input.quotationNumber,
    currency: input.currency,
    tax_amount: input.taxAmount,
    valid_until: input.validUntil,
    delivery_days: input.deliveryDays,
    payment_terms: input.paymentTerms,
    notes: input.notes,
    items: input.items,
  })
  repositoryError(error)
  return z.string().uuid().parse(data)
}

export function updateQuotationRepository(input: {
  quotationId: string
  expectedVersion: number
  supplierId: string
  quotationNumber: string | null
  currency: PurchaseRequestCurrency
  taxAmount: number
  validUntil: string | null
  deliveryDays: number | null
  paymentTerms: string | null
  notes: string | null
}) {
  return rpcVersion('update_quotation', {
    quotation_id: input.quotationId,
    expected_version: input.expectedVersion,
    supplier_id: input.supplierId,
    quotation_number: input.quotationNumber,
    currency: input.currency,
    tax_amount: input.taxAmount,
    valid_until: input.validUntil,
    delivery_days: input.deliveryDays,
    payment_terms: input.paymentTerms,
    notes: input.notes,
  })
}

export function addQuotationItemRepository(input: {
  quotationId: string
  expectedVersion: number
  purchaseRequestItemId: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
}) {
  return rpcVersion('add_quotation_item', {
    quotation_id: input.quotationId,
    expected_version: input.expectedVersion,
    purchase_request_item_id: input.purchaseRequestItemId,
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    unit_price: input.unitPrice,
  })
}

export function updateQuotationItemRepository(input: {
  quotationId: string
  itemId: string
  expectedVersion: number
  description: string
  quantity: number
  unit: string
  unitPrice: number
}) {
  return rpcVersion('update_quotation_item', {
    quotation_id: input.quotationId,
    item_id: input.itemId,
    expected_version: input.expectedVersion,
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    unit_price: input.unitPrice,
  })
}

export function removeQuotationItemRepository(input: {
  quotationId: string
  itemId: string
  expectedVersion: number
}) {
  return rpcVersion('remove_quotation_item', {
    quotation_id: input.quotationId,
    item_id: input.itemId,
    expected_version: input.expectedVersion,
  })
}

export function submitQuotationRepository(input: {
  quotationId: string
  expectedVersion: number
}) {
  return rpcVersion('submit_quotation', {
    quotation_id: input.quotationId,
    expected_version: input.expectedVersion,
  })
}

export async function listPurchaseRequestQuotationsRepository(purchaseRequestId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_purchase_request_quotations', {
    purchase_request_id: purchaseRequestId,
  })
  repositoryError(error)
  return z.array(quotationRowSchema).parse(data ?? []).map(mapQuotation)
}

export async function getQuotationRepository(quotationId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_quotation', { quotation_id: quotationId })
  repositoryError(error)
  const row = z.array(quotationRowSchema).parse(data ?? [])[0]
  return row ? mapQuotation(row) : null
}

export async function listQuotationItemsRepository(quotationId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_quotation_items', { quotation_id: quotationId })
  repositoryError(error)
  return z.array(quotationItemRowSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    purchaseRequestItemId: row.purchase_request_item_id,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    total: row.total,
    createdAt: row.created_at,
  } satisfies QuotationItemRecord))
}

export async function getSupplierSelectionRepository(purchaseRequestId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_supplier_selection', {
    purchase_request_id: purchaseRequestId,
  })
  repositoryError(error)
  const row = z.array(selectionRowSchema).parse(data ?? [])[0]
  if (!row) return null
  return {
    id: row.id,
    quotationId: row.quotation_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    quotationNumber: row.quotation_number,
    currency: row.currency as PurchaseRequestCurrency,
    total: row.total,
    justification: row.justification,
    selectedBy: row.selected_by,
    selectedByName: row.selected_by_name,
    selectedAt: row.selected_at,
  } satisfies SupplierSelectionRecord
}

export function selectSupplierRepository(input: {
  purchaseRequestId: string
  quotationId: string
  expectedRequestVersion: number
  expectedQuotationVersion: number
  justification: string
}) {
  return rpcVersion('select_supplier', {
    purchase_request_id: input.purchaseRequestId,
    quotation_id: input.quotationId,
    expected_request_version: input.expectedRequestVersion,
    expected_quotation_version: input.expectedQuotationVersion,
    justification: input.justification,
  })
}
