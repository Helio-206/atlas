'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  ActivateSupplier,
  BlockSupplier,
  CreateQuotation,
  CreateSupplier,
  DeactivateSupplier,
  SelectSupplier,
  SubmitQuotation,
  UpdateSupplier,
} from '../application/sourcing-use-cases'
import {
  quotationSchema,
  quotationSubmitSchema,
  supplierSchema,
  supplierSelectionSchema,
  supplierStatusSchema,
  supplierUpdateSchema,
} from '../contracts/sourcing-schemas'
import { ProcurementRepositoryError } from '../infrastructure/procurement-repository'

function formValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function parseJson(value: string) {
  try {
    return JSON.parse(value || '[]') as unknown
  } catch {
    return null
  }
}

function errorCode(error: unknown) {
  const message = error instanceof ProcurementRepositoryError ? error.message : ''
  if (message.includes('permission_denied')) return 'permission_denied'
  if (message.includes('supplier_tax_number_exists')) return 'duplicate_tax_number'
  if (message.includes('supplier_blocked')) return 'supplier_blocked'
  if (message.includes('approved_purchase_request_required')) return 'invalid_request_status'
  if (message.includes('version_conflict')) return 'version_conflict'
  if (message.includes('quotation_not_editable') || message.includes('quotation_not_submittable')) return 'quotation_not_editable'
  if (message.includes('quotation_items_required')) return 'quotation_items_required'
  if (message.includes('supplier_selection_justification_required')) return 'justification_required'
  if (message.includes('supplier_already_selected')) return 'supplier_already_selected'
  if (message.includes('not_found')) return 'not_found'
  return 'command_failed'
}

function supplierFields(formData: FormData) {
  return {
    name: formValue(formData, 'name'),
    taxNumber: formValue(formData, 'tax_number'),
    email: formValue(formData, 'email'),
    phone: formValue(formData, 'phone'),
    address: formValue(formData, 'address'),
  }
}

function revalidateSourcing(requestId?: string, supplierId?: string) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/suppliers')
  revalidatePath('/dashboard/procurement')
  if (supplierId) revalidatePath(`/dashboard/suppliers/${supplierId}`)
  if (requestId) {
    revalidatePath(`/dashboard/procurement/${requestId}`)
    revalidatePath(`/dashboard/procurement/${requestId}/quotations`)
  }
}

export async function createSupplierAction(formData: FormData) {
  const parsed = supplierSchema.safeParse(supplierFields(formData))
  if (!parsed.success) redirect('/dashboard/suppliers/new?error=invalid_form')

  let supplierId: string
  try {
    supplierId = await CreateSupplier(parsed.data)
  } catch (error) {
    redirect(`/dashboard/suppliers/new?error=${errorCode(error)}`)
  }
  revalidateSourcing(undefined, supplierId)
  redirect(`/dashboard/suppliers/${supplierId}?notice=supplier_created`)
}

export async function updateSupplierAction(formData: FormData) {
  const supplierId = formValue(formData, 'supplier_id')
  const parsed = supplierUpdateSchema.safeParse({
    supplierId,
    expectedVersion: formValue(formData, 'expected_version'),
    ...supplierFields(formData),
  })
  if (!parsed.success) redirect(`/dashboard/suppliers/${supplierId}?error=invalid_form`)
  try {
    await UpdateSupplier(parsed.data)
  } catch (error) {
    redirect(`/dashboard/suppliers/${supplierId}?error=${errorCode(error)}`)
  }
  revalidateSourcing(undefined, supplierId)
  redirect(`/dashboard/suppliers/${supplierId}?notice=supplier_updated`)
}

async function supplierStatusAction(
  formData: FormData,
  command: typeof ActivateSupplier,
  notice: string,
) {
  const supplierId = formValue(formData, 'supplier_id')
  const parsed = supplierStatusSchema.safeParse({
    supplierId,
    expectedVersion: formValue(formData, 'expected_version'),
  })
  if (!parsed.success) redirect(`/dashboard/suppliers/${supplierId}?error=invalid_form`)
  try {
    await command(parsed.data)
  } catch (error) {
    redirect(`/dashboard/suppliers/${supplierId}?error=${errorCode(error)}`)
  }
  revalidateSourcing(undefined, supplierId)
  redirect(`/dashboard/suppliers/${supplierId}?notice=${notice}`)
}

export async function activateSupplierAction(formData: FormData) {
  return supplierStatusAction(formData, ActivateSupplier, 'supplier_activated')
}

export async function deactivateSupplierAction(formData: FormData) {
  return supplierStatusAction(formData, DeactivateSupplier, 'supplier_deactivated')
}

export async function blockSupplierAction(formData: FormData) {
  return supplierStatusAction(formData, BlockSupplier, 'supplier_blocked')
}

export async function createQuotationAction(formData: FormData) {
  const requestId = formValue(formData, 'purchase_request_id')
  const parsed = quotationSchema.safeParse({
    purchaseRequestId: requestId,
    supplierId: formValue(formData, 'supplier_id'),
    quotationNumber: formValue(formData, 'quotation_number'),
    currency: formValue(formData, 'currency'),
    taxAmount: formValue(formData, 'tax_amount'),
    validUntil: formValue(formData, 'valid_until'),
    deliveryDays: formValue(formData, 'delivery_days'),
    paymentTerms: formValue(formData, 'payment_terms'),
    notes: formValue(formData, 'notes'),
    items: parseJson(formValue(formData, 'items_json')),
  })
  if (!parsed.success) redirect(`/dashboard/procurement/${requestId}/quotations?error=invalid_form`)

  try {
    await CreateQuotation(parsed.data)
  } catch (error) {
    redirect(`/dashboard/procurement/${requestId}/quotations?error=${errorCode(error)}`)
  }
  revalidateSourcing(requestId)
  redirect(`/dashboard/procurement/${requestId}/quotations?notice=quotation_created`)
}

export async function submitQuotationAction(formData: FormData) {
  const requestId = formValue(formData, 'purchase_request_id')
  const parsed = quotationSubmitSchema.safeParse({
    quotationId: formValue(formData, 'quotation_id'),
    expectedVersion: formValue(formData, 'expected_version'),
  })
  if (!parsed.success) redirect(`/dashboard/procurement/${requestId}/quotations?error=invalid_form`)
  try {
    await SubmitQuotation(parsed.data)
  } catch (error) {
    redirect(`/dashboard/procurement/${requestId}/quotations?error=${errorCode(error)}`)
  }
  revalidateSourcing(requestId)
  redirect(`/dashboard/procurement/${requestId}/quotations?notice=quotation_submitted`)
}

export async function selectSupplierAction(formData: FormData) {
  const requestId = formValue(formData, 'purchase_request_id')
  const parsed = supplierSelectionSchema.safeParse({
    purchaseRequestId: requestId,
    quotationId: formValue(formData, 'quotation_id'),
    expectedRequestVersion: formValue(formData, 'expected_request_version'),
    expectedQuotationVersion: formValue(formData, 'expected_quotation_version'),
    justification: formValue(formData, 'justification'),
  })
  if (!parsed.success) redirect(`/dashboard/procurement/${requestId}/quotations?error=justification_required`)
  try {
    await SelectSupplier(parsed.data)
  } catch (error) {
    redirect(`/dashboard/procurement/${requestId}/quotations?error=${errorCode(error)}`)
  }
  revalidateSourcing(requestId)
  redirect(`/dashboard/procurement/${requestId}/quotations?notice=supplier_selected`)
}
