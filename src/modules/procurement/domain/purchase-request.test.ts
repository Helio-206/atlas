import { describe, expect, it } from 'vitest'

import {
  PurchaseRequest,
  PurchaseRequestDomainError,
  type PurchaseRequestSnapshot,
} from './purchase-request'

function request(overrides: Partial<PurchaseRequestSnapshot> = {}) {
  return new PurchaseRequest({
    requestedBy: 'requester',
    projectActive: true,
    status: 'draft',
    currency: 'AOA',
    version: 1,
    items: [{ description: 'Cimento', quantity: 2, unit: 'saco', estimatedUnitPrice: 5000 }],
    ...overrides,
  })
}

describe('PurchaseRequest aggregate', () => {
  it('starts as draft and derives the total from items', () => {
    const aggregate = request()
    expect(aggregate.status).toBe('draft')
    expect(aggregate.version).toBe(1)
    expect(aggregate.estimatedTotal).toBe(10000)
  })

  it('rejects submission without items', () => {
    const aggregate = request({ items: [] })
    expect(() => aggregate.submit(1)).toThrowError('purchase_request_items_required')
  })

  it('rejects submission when the project is inactive', () => {
    const aggregate = request({ projectActive: false })
    expect(() => aggregate.submit(1)).toThrowError('active_project_required')
  })

  it('blocks self approval', () => {
    const aggregate = request({ status: 'technical_review' })
    expect(() => aggregate.approveTechnical(1, 'requester')).toThrowError('self_approval_forbidden')
  })

  it('moves technical review to financial review', () => {
    const aggregate = request({ status: 'technical_review' })
    aggregate.approveTechnical(1, 'technical')
    expect(aggregate.status).toBe('financial_review')
    expect(aggregate.version).toBe(2)
  })

  it('approves financially below the executive threshold', () => {
    const aggregate = request({ status: 'financial_review' })
    aggregate.approveFinancial(1, 'financial', 20000, 'AOA')
    expect(aggregate.status).toBe('approved')
  })

  it('requires executive review at or above threshold', () => {
    const aggregate = request({ status: 'financial_review' })
    aggregate.approveFinancial(1, 'financial', 10000, 'AOA')
    expect(aggregate.status).toBe('executive_review')
  })

  it('requires executive review when threshold currency differs', () => {
    const aggregate = request({ status: 'financial_review', currency: 'USD' })
    aggregate.approveFinancial(1, 'financial', 999999, 'AOA')
    expect(aggregate.status).toBe('executive_review')
  })

  it('completes executive approval', () => {
    const aggregate = request({ status: 'executive_review' })
    aggregate.approveExecutive(1, 'executive')
    expect(aggregate.status).toBe('approved')
  })

  it('returns a review to editable state', () => {
    const aggregate = request({ status: 'financial_review' })
    aggregate.returnForChanges(1, 'financial')
    expect(aggregate.status).toBe('returned')
    expect(aggregate.canEdit()).toBe(true)
  })

  it('rejects a request and terminates review', () => {
    const aggregate = request({ status: 'technical_review' })
    aggregate.reject(1, 'technical')
    expect(aggregate.status).toBe('rejected')
  })

  it('allows cancellation before final approval and blocks terminal edits', () => {
    const aggregate = request({ status: 'technical_review' })
    aggregate.cancel(1)
    expect(aggregate.status).toBe('cancelled')
    expect(() => aggregate.updateItems(2, [])).toThrowError('purchase_request_not_editable')
  })

  it('enforces optimistic concurrency', () => {
    const aggregate = request({ version: 3 })
    expect(() => aggregate.submit(2)).toThrow(PurchaseRequestDomainError)
    expect(() => aggregate.submit(2)).toThrowError('purchase_request_version_conflict')
  })
})
