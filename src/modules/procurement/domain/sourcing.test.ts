import { describe, expect, it } from 'vitest'

import {
  assertOptimisticVersion,
  calculateCoverage,
  calculateQuotationTotals,
  getComparisonHighlights,
  SourcingDomainError,
  validateQuotationContext,
  validateSupplier,
  validateSupplierSelection,
} from './sourcing'

function expectCode(fn: () => unknown, code: string) {
  expect(fn).toThrowError(SourcingDomainError)
  try { fn() } catch (error) { expect((error as SourcingDomainError).code).toBe(code) }
}

describe('Sprint 3 sourcing domain', () => {
  it('creates a normalized supplier', () => {
    expect(validateSupplier({ name: '  Atlas Steel  ', taxNumber: '  123  ' })).toEqual({ name: 'Atlas Steel', taxNumber: '123' })
  })

  it('rejects duplicated tax number', () => {
    expectCode(() => validateSupplier({ name: 'B', taxNumber: '123', existingTaxNumbers: ['123'] }), 'supplier_tax_number_exists')
  })

  it('rejects blocked supplier quotation', () => {
    expectCode(() => validateQuotationContext({ purchaseRequestStatus: 'approved', requestCompanyId: 'a', supplierCompanyId: 'a', supplierStatus: 'blocked' }), 'supplier_blocked')
  })

  it('rejects quotation for invalid PR status', () => {
    expectCode(() => validateQuotationContext({ purchaseRequestStatus: 'draft', requestCompanyId: 'a', supplierCompanyId: 'a', supplierStatus: 'active' }), 'approved_purchase_request_required')
  })

  it('rejects cross-tenant supplier', () => {
    expectCode(() => validateQuotationContext({ purchaseRequestStatus: 'approved', requestCompanyId: 'a', supplierCompanyId: 'b', supplierStatus: 'active' }), 'cross_tenant_supplier')
  })

  it('derives quotation totals from lines', () => {
    expect(calculateQuotationTotals([{ quantity: 2, unitPrice: 100 }, { quantity: 3, unitPrice: 50 }], 35)).toEqual({ subtotal: 350, taxAmount: 35, total: 385 })
  })

  it('supports partial quotation coverage', () => {
    expect(calculateCoverage(['1'], ['1', '2'])).toEqual({ count: 1, total: 2, percent: 50, partial: true })
  })

  it('rejects invalid quantities', () => {
    expectCode(() => calculateQuotationTotals([{ quantity: 0, unitPrice: 100 }]), 'invalid_quotation_item_quantity')
  })

  it('accepts valid supplier selection', () => {
    expect(() => validateSupplierSelection({ purchaseRequestStatus: 'approved', purchaseRequestId: 'pr', quotationPurchaseRequestId: 'pr', supplierStatus: 'active', quotationStatus: 'submitted', justification: 'Melhor prazo contratual', selectionExists: false })).not.toThrow()
  })

  it('rejects quotation from another request', () => {
    expectCode(() => validateSupplierSelection({ purchaseRequestStatus: 'approved', purchaseRequestId: 'a', quotationPurchaseRequestId: 'b', supplierStatus: 'active', quotationStatus: 'submitted', justification: 'ok', selectionExists: false }), 'wrong_quotation')
  })

  it('rejects blocked supplier selection', () => {
    expectCode(() => validateSupplierSelection({ purchaseRequestStatus: 'approved', purchaseRequestId: 'a', quotationPurchaseRequestId: 'a', supplierStatus: 'blocked', quotationStatus: 'submitted', justification: 'ok', selectionExists: false }), 'supplier_blocked')
  })

  it('rejects duplicate selection', () => {
    expectCode(() => validateSupplierSelection({ purchaseRequestStatus: 'approved', purchaseRequestId: 'a', quotationPurchaseRequestId: 'a', supplierStatus: 'active', quotationStatus: 'submitted', justification: 'ok', selectionExists: true }), 'supplier_already_selected')
  })

  it('enforces optimistic concurrency', () => {
    expectCode(() => assertOptimisticVersion(3, 2), 'version_conflict')
  })

  it('does not rank price across currencies', () => {
    expect(getComparisonHighlights([
      { id: 'a', currency: 'AOA', total: 100, deliveryDays: 5, coveragePercent: 100 },
      { id: 'b', currency: 'USD', total: 1, deliveryDays: 3, coveragePercent: 50 },
    ])).toMatchObject({ sameCurrency: false, lowestPriceId: null, currencyWarning: 'Quotations in different currencies cannot be directly compared without an exchange rate.' })
  })
})
