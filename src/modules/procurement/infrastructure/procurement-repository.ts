import 'server-only'

import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import type {
  PurchaseRequestCurrency,
  PurchaseRequestPriority,
  PurchaseRequestStatus,
} from '../domain/purchase-request'
import type { ProcurementPermission } from '../domain/permissions'

const requestRowSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  project_name: z.string(),
  request_number: z.string(),
  requested_by: z.string().uuid(),
  requester_name: z.string().nullable(),
  purpose: z.string(),
  priority: z.string(),
  required_date: z.string(),
  status: z.string(),
  estimated_total: z.coerce.number(),
  currency: z.string(),
  current_approver_role: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  submitted_at: z.string().nullable(),
  approved_at: z.string().nullable(),
  version: z.coerce.number().int(),
})

const pendingRowSchema = requestRowSchema.omit({
  current_approver_role: true,
  updated_at: true,
  submitted_at: true,
  approved_at: true,
})

const itemRowSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  quantity: z.coerce.number(),
  unit: z.string(),
  estimated_unit_price: z.coerce.number(),
  created_at: z.string(),
})

const decisionRowSchema = z.object({
  id: z.string().uuid(),
  stage: z.string(),
  decision: z.string(),
  decided_by: z.string().uuid(),
  decided_by_name: z.string().nullable(),
  comment: z.string().nullable(),
  created_at: z.string(),
})

const auditRowSchema = z.object({
  action: z.string(),
  user_id: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
})

const settingsRowSchema = z.object({
  executive_approval_threshold: z.coerce.number(),
  currency: z.string(),
  updated_at: z.string(),
})

export type PurchaseRequestRecord = {
  id: string
  projectId: string
  projectName: string
  requestNumber: string
  requestedBy: string
  requesterName: string | null
  purpose: string
  priority: PurchaseRequestPriority
  requiredDate: string
  status: PurchaseRequestStatus
  estimatedTotal: number
  currency: PurchaseRequestCurrency
  currentApproverRole: string | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  approvedAt: string | null
  version: number
}

export type PurchaseRequestItemRecord = {
  id: string
  description: string
  quantity: number
  unit: string
  estimatedUnitPrice: number
  createdAt: string
}

export type ApprovalDecisionRecord = {
  id: string
  stage: string
  decision: string
  decidedBy: string
  decidedByName: string | null
  comment: string | null
  createdAt: string
}

export type AuditRecord = {
  action: string
  userId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type ApprovalSettingsRecord = {
  executiveApprovalThreshold: number
  currency: PurchaseRequestCurrency
  updatedAt: string
}

export class ProcurementRepositoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProcurementRepositoryError'
  }
}

function repositoryError(error: { message?: string; code?: string } | null) {
  if (!error) return
  throw new ProcurementRepositoryError(
    [error.code, error.message].filter(Boolean).join(': '),
  )
}

function mapRequest(row: z.infer<typeof requestRowSchema>): PurchaseRequestRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    requestNumber: row.request_number,
    requestedBy: row.requested_by,
    requesterName: row.requester_name,
    purpose: row.purpose,
    priority: row.priority as PurchaseRequestPriority,
    requiredDate: row.required_date,
    status: row.status as PurchaseRequestStatus,
    estimatedTotal: row.estimated_total,
    currency: row.currency as PurchaseRequestCurrency,
    currentApproverRole: row.current_approver_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    version: row.version,
  }
}

export async function getProcurementPermissionsRepository() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_procurement_permissions')
  repositoryError(error)
  return z.array(z.string()).parse(data ?? []) as ProcurementPermission[]
}

export async function createPurchaseRequestRepository(input: {
  projectId: string
  purpose: string
  priority: PurchaseRequestPriority
  requiredDate: string
  currency: PurchaseRequestCurrency
  items: Array<{
    description: string
    quantity: number
    unit: string
    estimatedUnitPrice: number
  }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('create_purchase_request', {
    project_id: input.projectId,
    purpose: input.purpose,
    priority: input.priority,
    required_date: input.requiredDate,
    currency: input.currency,
    items: input.items,
  })
  repositoryError(error)
  return z.string().uuid().parse(data)
}

export async function updatePurchaseRequestRepository(input: {
  purchaseRequestId: string
  expectedVersion: number
  projectId: string
  purpose: string
  priority: PurchaseRequestPriority
  requiredDate: string
  currency: PurchaseRequestCurrency
}) {
  return versionCommand('update_purchase_request', {
    purchase_request_id: input.purchaseRequestId,
    expected_version: input.expectedVersion,
    project_id: input.projectId,
    purpose: input.purpose,
    priority: input.priority,
    required_date: input.requiredDate,
    currency: input.currency,
  })
}

export async function addPurchaseRequestItemRepository(input: {
  purchaseRequestId: string
  expectedVersion: number
  description: string
  quantity: number
  unit: string
  estimatedUnitPrice: number
}) {
  return versionCommand('add_purchase_request_item', {
    purchase_request_id: input.purchaseRequestId,
    expected_version: input.expectedVersion,
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    estimated_unit_price: input.estimatedUnitPrice,
  })
}

export async function updatePurchaseRequestItemRepository(input: {
  purchaseRequestId: string
  itemId: string
  expectedVersion: number
  description: string
  quantity: number
  unit: string
  estimatedUnitPrice: number
}) {
  return versionCommand('update_purchase_request_item', {
    purchase_request_id: input.purchaseRequestId,
    item_id: input.itemId,
    expected_version: input.expectedVersion,
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    estimated_unit_price: input.estimatedUnitPrice,
  })
}

export async function removePurchaseRequestItemRepository(input: {
  purchaseRequestId: string
  itemId: string
  expectedVersion: number
}) {
  return versionCommand('remove_purchase_request_item', {
    purchase_request_id: input.purchaseRequestId,
    item_id: input.itemId,
    expected_version: input.expectedVersion,
  })
}

export async function submitPurchaseRequestRepository(input: {
  purchaseRequestId: string
  expectedVersion: number
}) {
  return versionCommand('submit_purchase_request', {
    purchase_request_id: input.purchaseRequestId,
    expected_version: input.expectedVersion,
  })
}

export async function approveTechnicalReviewRepository(input: DecisionInput) {
  return decisionCommand('approve_technical_review', input)
}

export async function approveFinancialReviewRepository(input: DecisionInput) {
  return decisionCommand('approve_financial_review', input)
}

export async function approveExecutiveReviewRepository(input: DecisionInput) {
  return decisionCommand('approve_executive_review', input)
}

export async function returnPurchaseRequestRepository(input: DecisionInput) {
  return decisionCommand('return_purchase_request', input)
}

export async function rejectPurchaseRequestRepository(input: DecisionInput) {
  return decisionCommand('reject_purchase_request', input)
}

export async function cancelPurchaseRequestRepository(input: {
  purchaseRequestId: string
  expectedVersion: number
}) {
  return versionCommand('cancel_purchase_request', {
    purchase_request_id: input.purchaseRequestId,
    expected_version: input.expectedVersion,
  })
}

export async function listPurchaseRequestsRepository(filters: {
  status?: PurchaseRequestStatus
  projectId?: string
  priority?: PurchaseRequestPriority
}) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_purchase_requests', {
    status_filter: filters.status ?? null,
    project_id_filter: filters.projectId ?? null,
    priority_filter: filters.priority ?? null,
  })
  repositoryError(error)
  return z.array(requestRowSchema).parse(data ?? []).map(mapRequest)
}

export async function getPurchaseRequestRepository(purchaseRequestId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_purchase_request', {
    purchase_request_id: purchaseRequestId,
  })
  repositoryError(error)
  const rows = z.array(requestRowSchema).parse(data ?? [])
  return rows[0] ? mapRequest(rows[0]) : null
}

export async function listPurchaseRequestItemsRepository(purchaseRequestId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_purchase_request_items', {
    purchase_request_id: purchaseRequestId,
  })
  repositoryError(error)
  return z.array(itemRowSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    estimatedUnitPrice: row.estimated_unit_price,
    createdAt: row.created_at,
  }))
}

export async function listPurchaseRequestDecisionsRepository(purchaseRequestId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_purchase_request_decisions', {
    purchase_request_id: purchaseRequestId,
  })
  repositoryError(error)
  return z.array(decisionRowSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    stage: row.stage,
    decision: row.decision,
    decidedBy: row.decided_by,
    decidedByName: row.decided_by_name,
    comment: row.comment,
    createdAt: row.created_at,
  }))
}

export async function listPurchaseRequestAuditRepository(purchaseRequestId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_purchase_request_audit', {
    purchase_request_id: purchaseRequestId,
  })
  repositoryError(error)
  return z.array(auditRowSchema).parse(data ?? []).map((row) => ({
    action: row.action,
    userId: row.user_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }))
}

export async function listPendingApprovalsRepository() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_pending_approvals')
  repositoryError(error)
  return z.array(pendingRowSchema).parse(data ?? []).map((row) =>
    mapRequest({
      ...row,
      current_approver_role: null,
      updated_at: row.created_at,
      submitted_at: null,
      approved_at: null,
    }),
  )
}

export async function getApprovalSettingsRepository() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_procurement_approval_settings')
  repositoryError(error)
  const row = z.array(settingsRowSchema).parse(data ?? [])[0]
  if (!row) return null
  return {
    executiveApprovalThreshold: row.executive_approval_threshold,
    currency: row.currency as PurchaseRequestCurrency,
    updatedAt: row.updated_at,
  }
}

export async function updateApprovalSettingsRepository(input: {
  threshold: number
  currency: PurchaseRequestCurrency
}) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('update_procurement_approval_settings', {
    threshold: input.threshold,
    currency: input.currency,
  })
  repositoryError(error)
}

type DecisionInput = {
  purchaseRequestId: string
  expectedVersion: number
  comment?: string
}

async function decisionCommand(name: string, input: DecisionInput) {
  return versionCommand(name, {
    purchase_request_id: input.purchaseRequestId,
    expected_version: input.expectedVersion,
    comment: input.comment || null,
  })
}

async function versionCommand(name: string, args: Record<string, unknown>) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc(name, args)
  repositoryError(error)
  return z.coerce.number().int().positive().parse(data)
}
