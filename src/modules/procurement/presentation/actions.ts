'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  AddPurchaseRequestItem,
  ApproveExecutiveReview,
  ApproveFinancialReview,
  ApproveTechnicalReview,
  CancelPurchaseRequest,
  CreatePurchaseRequest,
  RejectPurchaseRequest,
  RemovePurchaseRequestItem,
  ReturnPurchaseRequest,
  SubmitPurchaseRequest,
  UpdateApprovalSettings,
  UpdatePurchaseRequest,
  UpdatePurchaseRequestItem,
} from '../application/use-cases'
import {
  addPurchaseRequestItemSchema,
  approvalSettingsSchema,
  createPurchaseRequestSchema,
  purchaseRequestCommandSchema,
  purchaseRequestDecisionSchema,
  removePurchaseRequestItemSchema,
  updatePurchaseRequestItemSchema,
  updatePurchaseRequestSchema,
} from '../contracts/schemas'
import { ProcurementRepositoryError } from '../infrastructure/procurement-repository'

function formValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function repositoryMessage(error: unknown) {
  return error instanceof ProcurementRepositoryError ? error.message : ''
}

function requestFields(formData: FormData) {
  return {
    projectId: formValue(formData, 'project_id'),
    purpose: formValue(formData, 'purpose'),
    priority: formValue(formData, 'priority'),
    requiredDate: formValue(formData, 'required_date'),
    currency: formValue(formData, 'currency'),
  }
}

function parseItems(formData: FormData) {
  const raw = formValue(formData, 'items_json')
  try {
    return JSON.parse(raw || '[]') as unknown
  } catch {
    return null
  }
}

function errorCode(error: unknown) {
  const message = repositoryMessage(error)
  if (message.includes('version_conflict')) return 'version_conflict'
  if (message.includes('not_editable')) return 'not_editable'
  if (message.includes('items_required')) return 'items_required'
  if (message.includes('active_project_required')) return 'active_project_required'
  if (message.includes('self_approval_forbidden')) return 'self_approval'
  if (message.includes('permission_denied') || message.includes('administrator_required')) return 'permission_denied'
  if (message.includes('not_found')) return 'not_found'
  if (message.includes('invalid_purchase_request_transition') || message.includes('not_submittable')) return 'invalid_transition'
  return 'command_failed'
}

function redirectRequestError(requestId: string, error: unknown): never {
  redirect(`/dashboard/procurement/${requestId}?error=${errorCode(error)}`)
}

function revalidateProcurement(requestId?: string) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/procurement')
  revalidatePath('/dashboard/approvals')
  if (requestId) revalidatePath(`/dashboard/procurement/${requestId}`)
}

export async function createPurchaseRequestAction(formData: FormData) {
  const parsed = createPurchaseRequestSchema.safeParse({
    ...requestFields(formData),
    items: parseItems(formData),
  })

  if (!parsed.success) {
    redirect('/dashboard/procurement/new?error=invalid_form')
  }

  let requestId: string
  try {
    requestId = await CreatePurchaseRequest.execute(parsed.data)
  } catch (error) {
    redirect(`/dashboard/procurement/new?error=${errorCode(error)}`)
  }

  revalidateProcurement(requestId)
  redirect(`/dashboard/procurement/${requestId}?notice=created`)
}

export async function updatePurchaseRequestAction(formData: FormData) {
  const requestId = formValue(formData, 'purchase_request_id')
  const parsed = updatePurchaseRequestSchema.safeParse({
    purchaseRequestId: requestId,
    expectedVersion: formValue(formData, 'expected_version'),
    ...requestFields(formData),
  })

  if (!parsed.success) {
    redirect(`/dashboard/procurement/${requestId}?error=invalid_form`)
  }

  try {
    await UpdatePurchaseRequest.execute(parsed.data)
  } catch (error) {
    redirectRequestError(parsed.data.purchaseRequestId, error)
  }

  revalidateProcurement(parsed.data.purchaseRequestId)
  redirect(`/dashboard/procurement/${parsed.data.purchaseRequestId}?notice=updated`)
}

export async function addPurchaseRequestItemAction(formData: FormData) {
  const requestId = formValue(formData, 'purchase_request_id')
  const parsed = addPurchaseRequestItemSchema.safeParse({
    purchaseRequestId: requestId,
    expectedVersion: formValue(formData, 'expected_version'),
    description: formValue(formData, 'description'),
    quantity: formValue(formData, 'quantity'),
    unit: formValue(formData, 'unit'),
    estimatedUnitPrice: formValue(formData, 'estimated_unit_price'),
  })
  if (!parsed.success) redirect(`/dashboard/procurement/${requestId}?error=invalid_form`)

  try {
    await AddPurchaseRequestItem.execute(parsed.data)
  } catch (error) {
    redirectRequestError(parsed.data.purchaseRequestId, error)
  }

  revalidateProcurement(parsed.data.purchaseRequestId)
  redirect(`/dashboard/procurement/${parsed.data.purchaseRequestId}?notice=item_added`)
}

export async function updatePurchaseRequestItemAction(formData: FormData) {
  const requestId = formValue(formData, 'purchase_request_id')
  const parsed = updatePurchaseRequestItemSchema.safeParse({
    purchaseRequestId: requestId,
    itemId: formValue(formData, 'item_id'),
    expectedVersion: formValue(formData, 'expected_version'),
    description: formValue(formData, 'description'),
    quantity: formValue(formData, 'quantity'),
    unit: formValue(formData, 'unit'),
    estimatedUnitPrice: formValue(formData, 'estimated_unit_price'),
  })
  if (!parsed.success) redirect(`/dashboard/procurement/${requestId}?error=invalid_form`)

  try {
    await UpdatePurchaseRequestItem.execute(parsed.data)
  } catch (error) {
    redirectRequestError(parsed.data.purchaseRequestId, error)
  }

  revalidateProcurement(parsed.data.purchaseRequestId)
  redirect(`/dashboard/procurement/${parsed.data.purchaseRequestId}?notice=item_updated`)
}

export async function removePurchaseRequestItemAction(formData: FormData) {
  const requestId = formValue(formData, 'purchase_request_id')
  const parsed = removePurchaseRequestItemSchema.safeParse({
    purchaseRequestId: requestId,
    itemId: formValue(formData, 'item_id'),
    expectedVersion: formValue(formData, 'expected_version'),
  })
  if (!parsed.success) redirect(`/dashboard/procurement/${requestId}?error=invalid_form`)

  try {
    await RemovePurchaseRequestItem.execute(parsed.data)
  } catch (error) {
    redirectRequestError(parsed.data.purchaseRequestId, error)
  }

  revalidateProcurement(parsed.data.purchaseRequestId)
  redirect(`/dashboard/procurement/${parsed.data.purchaseRequestId}?notice=item_removed`)
}

async function simpleCommand(
  formData: FormData,
  command: typeof SubmitPurchaseRequest | typeof CancelPurchaseRequest,
  notice: 'submitted' | 'cancelled',
) {
  const requestId = formValue(formData, 'purchase_request_id')
  const parsed = purchaseRequestCommandSchema.safeParse({
    purchaseRequestId: requestId,
    expectedVersion: formValue(formData, 'expected_version'),
  })
  if (!parsed.success) redirect(`/dashboard/procurement/${requestId}?error=invalid_form`)

  try {
    await command.execute(parsed.data)
  } catch (error) {
    redirectRequestError(parsed.data.purchaseRequestId, error)
  }

  revalidateProcurement(parsed.data.purchaseRequestId)
  redirect(`/dashboard/procurement/${parsed.data.purchaseRequestId}?notice=${notice}`)
}

async function decisionCommand(
  formData: FormData,
  command:
    | typeof ApproveTechnicalReview
    | typeof ApproveFinancialReview
    | typeof ApproveExecutiveReview
    | typeof ReturnPurchaseRequest
    | typeof RejectPurchaseRequest,
  notice:
    | 'technical_approved'
    | 'financial_approved'
    | 'executive_approved'
    | 'returned'
    | 'rejected',
) {
  const requestId = formValue(formData, 'purchase_request_id')
  const parsed = purchaseRequestDecisionSchema.safeParse({
    purchaseRequestId: requestId,
    expectedVersion: formValue(formData, 'expected_version'),
    comment: formValue(formData, 'comment'),
  })
  if (!parsed.success) redirect(`/dashboard/procurement/${requestId}?error=invalid_form`)

  try {
    await command.execute(parsed.data)
  } catch (error) {
    redirectRequestError(parsed.data.purchaseRequestId, error)
  }

  revalidateProcurement(parsed.data.purchaseRequestId)
  redirect(`/dashboard/procurement/${parsed.data.purchaseRequestId}?notice=${notice}`)
}

export async function submitPurchaseRequestAction(formData: FormData) {
  return simpleCommand(formData, SubmitPurchaseRequest, 'submitted')
}

export async function cancelPurchaseRequestAction(formData: FormData) {
  return simpleCommand(formData, CancelPurchaseRequest, 'cancelled')
}

export async function approveTechnicalReviewAction(formData: FormData) {
  return decisionCommand(formData, ApproveTechnicalReview, 'technical_approved')
}

export async function approveFinancialReviewAction(formData: FormData) {
  return decisionCommand(formData, ApproveFinancialReview, 'financial_approved')
}

export async function approveExecutiveReviewAction(formData: FormData) {
  return decisionCommand(formData, ApproveExecutiveReview, 'executive_approved')
}

export async function returnPurchaseRequestAction(formData: FormData) {
  return decisionCommand(formData, ReturnPurchaseRequest, 'returned')
}

export async function rejectPurchaseRequestAction(formData: FormData) {
  return decisionCommand(formData, RejectPurchaseRequest, 'rejected')
}

export async function updateApprovalSettingsAction(formData: FormData) {
  const parsed = approvalSettingsSchema.safeParse({
    threshold: formValue(formData, 'threshold'),
    currency: formValue(formData, 'currency'),
  })

  if (!parsed.success) redirect('/dashboard/procurement?error=invalid_form')

  try {
    await UpdateApprovalSettings.execute(parsed.data)
  } catch (error) {
    redirect(`/dashboard/procurement?error=${errorCode(error)}`)
  }

  revalidateProcurement()
  redirect('/dashboard/procurement?notice=settings_updated')
}
