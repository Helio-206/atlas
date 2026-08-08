export const purchaseRequestStatuses = [
  'draft',
  'submitted',
  'technical_review',
  'financial_review',
  'executive_review',
  'approved',
  'returned',
  'rejected',
  'cancelled',
] as const

export const purchaseRequestPriorities = ['low', 'normal', 'high', 'urgent'] as const
export const purchaseRequestCurrencies = ['AOA', 'USD', 'EUR'] as const

export type PurchaseRequestStatus = (typeof purchaseRequestStatuses)[number]
export type PurchaseRequestPriority = (typeof purchaseRequestPriorities)[number]
export type PurchaseRequestCurrency = (typeof purchaseRequestCurrencies)[number]

export type PurchaseRequestItem = {
  id?: string
  description: string
  quantity: number
  unit: string
  estimatedUnitPrice: number
}

export type PurchaseRequestSnapshot = {
  requestedBy: string
  projectActive: boolean
  status: PurchaseRequestStatus
  currency: PurchaseRequestCurrency
  version: number
  items: PurchaseRequestItem[]
}

export class PurchaseRequestDomainError extends Error {}

export class PurchaseRequest {
  private state: PurchaseRequestSnapshot

  constructor(snapshot: PurchaseRequestSnapshot) {
    this.state = structuredClone(snapshot)
  }

  get status() {
    return this.state.status
  }

  get version() {
    return this.state.version
  }

  get estimatedTotal() {
    return this.state.items.reduce(
      (total, item) => total + item.quantity * item.estimatedUnitPrice,
      0,
    )
  }

  get items() {
    return structuredClone(this.state.items)
  }

  canEdit() {
    return this.state.status === 'draft' || this.state.status === 'returned'
  }

  updateItems(expectedVersion: number, items: PurchaseRequestItem[]) {
    this.assertVersion(expectedVersion)
    this.assertEditable()
    this.state.items = structuredClone(items)
    this.bumpVersion()
  }

  submit(expectedVersion: number) {
    this.assertVersion(expectedVersion)
    this.assertEditable()

    if (!this.state.projectActive) {
      throw new PurchaseRequestDomainError('active_project_required')
    }

    if (this.state.items.length === 0) {
      throw new PurchaseRequestDomainError('purchase_request_items_required')
    }

    this.state.status = 'technical_review'
    this.bumpVersion()
  }

  approveTechnical(expectedVersion: number, actorId: string) {
    this.assertVersion(expectedVersion)
    this.assertNotSelfApproval(actorId)

    if (this.state.status !== 'technical_review') {
      throw new PurchaseRequestDomainError('invalid_purchase_request_transition')
    }

    this.state.status = 'financial_review'
    this.bumpVersion()
  }

  approveFinancial(
    expectedVersion: number,
    actorId: string,
    executiveThreshold: number,
    thresholdCurrency: PurchaseRequestCurrency,
  ) {
    this.assertVersion(expectedVersion)
    this.assertNotSelfApproval(actorId)

    if (this.state.status !== 'financial_review') {
      throw new PurchaseRequestDomainError('invalid_purchase_request_transition')
    }

    const requiresExecutiveReview =
      this.state.currency !== thresholdCurrency ||
      this.estimatedTotal >= executiveThreshold

    this.state.status = requiresExecutiveReview ? 'executive_review' : 'approved'
    this.bumpVersion()
  }

  approveExecutive(expectedVersion: number, actorId: string) {
    this.assertVersion(expectedVersion)
    this.assertNotSelfApproval(actorId)

    if (this.state.status !== 'executive_review') {
      throw new PurchaseRequestDomainError('invalid_purchase_request_transition')
    }

    this.state.status = 'approved'
    this.bumpVersion()
  }

  returnForChanges(expectedVersion: number, actorId: string) {
    this.assertVersion(expectedVersion)
    this.assertNotSelfApproval(actorId)
    this.assertReviewState()
    this.state.status = 'returned'
    this.bumpVersion()
  }

  reject(expectedVersion: number, actorId: string) {
    this.assertVersion(expectedVersion)
    this.assertNotSelfApproval(actorId)
    this.assertReviewState()
    this.state.status = 'rejected'
    this.bumpVersion()
  }

  cancel(expectedVersion: number) {
    this.assertVersion(expectedVersion)

    if (['approved', 'rejected', 'cancelled'].includes(this.state.status)) {
      throw new PurchaseRequestDomainError('purchase_request_not_cancellable')
    }

    this.state.status = 'cancelled'
    this.bumpVersion()
  }

  private assertEditable() {
    if (!this.canEdit()) {
      throw new PurchaseRequestDomainError('purchase_request_not_editable')
    }
  }

  private assertReviewState() {
    if (
      !['technical_review', 'financial_review', 'executive_review'].includes(
        this.state.status,
      )
    ) {
      throw new PurchaseRequestDomainError('invalid_purchase_request_transition')
    }
  }

  private assertNotSelfApproval(actorId: string) {
    if (actorId === this.state.requestedBy) {
      throw new PurchaseRequestDomainError('self_approval_forbidden')
    }
  }

  private assertVersion(expectedVersion: number) {
    if (expectedVersion !== this.state.version) {
      throw new PurchaseRequestDomainError('purchase_request_version_conflict')
    }
  }

  private bumpVersion() {
    this.state.version += 1
  }
}
