import type { PurchaseRequestStatus } from './purchase-request'

export const SUPPLIER_STATUSES = ['active', 'inactive', 'blocked'] as const
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number]

export const QUOTATION_STATUSES = ['draft', 'submitted', 'accepted', 'rejected', 'expired'] as const
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number]

export type QuotationCurrency = 'AOA' | 'USD' | 'EUR'

export class SourcingDomainError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'SourcingDomainError'
  }
}

export function validateSupplier(input: {
  name: string
  taxNumber?: string | null
  existingTaxNumbers?: string[]
}) {
  const name = input.name.trim()
  const taxNumber = input.taxNumber?.trim() || null
  if (!name || name.length > 200) throw new SourcingDomainError('invalid_supplier_name')
  if (taxNumber && input.existingTaxNumbers?.includes(taxNumber)) {
    throw new SourcingDomainError('supplier_tax_number_exists')
  }
  return { name, taxNumber }
}

export function validateQuotationContext(input: {
  purchaseRequestStatus: PurchaseRequestStatus
  requestCompanyId: string
  supplierCompanyId: string
  supplierStatus: SupplierStatus
}) {
  if (input.purchaseRequestStatus !== 'approved') {
    throw new SourcingDomainError('approved_purchase_request_required')
  }
  if (input.requestCompanyId !== input.supplierCompanyId) {
    throw new SourcingDomainError('cross_tenant_supplier')
  }
  if (input.supplierStatus === 'blocked') throw new SourcingDomainError('supplier_blocked')
}

export function calculateQuotationTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxAmount = 0,
) {
  for (const item of items) {
    if (!(item.quantity > 0)) throw new SourcingDomainError('invalid_quotation_item_quantity')
    if (item.unitPrice < 0) throw new SourcingDomainError('invalid_quotation_item_unit_price')
  }
  if (taxAmount < 0) throw new SourcingDomainError('invalid_quotation_tax_amount')
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  return { subtotal, taxAmount, total: subtotal + taxAmount }
}

export function calculateCoverage(quotedItemIds: string[], requestItemIds: string[]) {
  if (requestItemIds.length === 0) return { count: 0, total: 0, percent: 0, partial: false }
  const requestSet = new Set(requestItemIds)
  const covered = new Set(quotedItemIds.filter((id) => requestSet.has(id))).size
  const percent = (covered / requestSet.size) * 100
  return { count: covered, total: requestSet.size, percent, partial: covered < requestSet.size }
}

export function validateSupplierSelection(input: {
  purchaseRequestStatus: PurchaseRequestStatus
  purchaseRequestId: string
  quotationPurchaseRequestId: string
  supplierStatus: SupplierStatus
  quotationStatus: QuotationStatus
  justification: string
  selectionExists: boolean
}) {
  if (input.purchaseRequestStatus !== 'approved') {
    throw new SourcingDomainError('approved_purchase_request_required')
  }
  if (input.purchaseRequestId !== input.quotationPurchaseRequestId) {
    throw new SourcingDomainError('wrong_quotation')
  }
  if (input.quotationStatus !== 'submitted') {
    throw new SourcingDomainError('submitted_quotation_required')
  }
  if (input.supplierStatus === 'blocked') throw new SourcingDomainError('supplier_blocked')
  if (!input.justification.trim()) {
    throw new SourcingDomainError('supplier_selection_justification_required')
  }
  if (input.selectionExists) throw new SourcingDomainError('supplier_already_selected')
}

export function assertOptimisticVersion(actual: number, expected: number) {
  if (actual !== expected) throw new SourcingDomainError('version_conflict')
}

export type QuotationComparisonInput = {
  id: string
  currency: QuotationCurrency
  total: number
  deliveryDays: number | null
  coveragePercent: number
}

export function getComparisonHighlights(quotations: QuotationComparisonInput[]) {
  const currencies = new Set(quotations.map((quotation) => quotation.currency))
  const sameCurrency = currencies.size <= 1
  const submitted = quotations.filter((quotation) => quotation.total >= 0)
  const lowestPriceId = sameCurrency && submitted.length
    ? [...submitted].sort((a, b) => a.total - b.total)[0]?.id ?? null
    : null
  const deliveryCandidates = submitted.filter((quotation) => quotation.deliveryDays !== null)
  const fastestDeliveryId = deliveryCandidates.length
    ? [...deliveryCandidates].sort((a, b) => (a.deliveryDays ?? Infinity) - (b.deliveryDays ?? Infinity))[0]?.id ?? null
    : null
  const bestCoverageId = submitted.length
    ? [...submitted].sort((a, b) => b.coveragePercent - a.coveragePercent)[0]?.id ?? null
    : null

  return {
    sameCurrency,
    lowestPriceId,
    fastestDeliveryId,
    bestCoverageId,
    currencyWarning: sameCurrency
      ? null
      : 'Quotations in different currencies cannot be directly compared without an exchange rate.',
  }
}
