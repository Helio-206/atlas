import 'server-only'

import { z } from 'zod'

import {
  addPurchaseRequestItemSchema,
  approvalSettingsSchema,
  createPurchaseRequestSchema,
  purchaseRequestCommandSchema,
  purchaseRequestDecisionSchema,
  purchaseRequestFiltersSchema,
  removePurchaseRequestItemSchema,
  updatePurchaseRequestItemSchema,
  updatePurchaseRequestSchema,
} from '../contracts/schemas'
import {
  addPurchaseRequestItemRepository,
  approveExecutiveReviewRepository,
  approveFinancialReviewRepository,
  approveTechnicalReviewRepository,
  cancelPurchaseRequestRepository,
  createPurchaseRequestRepository,
  getApprovalSettingsRepository,
  getProcurementPermissionsRepository,
  getPurchaseRequestRepository,
  listPendingApprovalsRepository,
  listPurchaseRequestAuditRepository,
  listPurchaseRequestDecisionsRepository,
  listPurchaseRequestItemsRepository,
  listPurchaseRequestsRepository,
  rejectPurchaseRequestRepository,
  removePurchaseRequestItemRepository,
  returnPurchaseRequestRepository,
  submitPurchaseRequestRepository,
  updateApprovalSettingsRepository,
  updatePurchaseRequestItemRepository,
  updatePurchaseRequestRepository,
} from '../infrastructure/procurement-repository'

const uuidSchema = z.string().uuid()

export const CreatePurchaseRequest = {
  execute(input: unknown) {
    return createPurchaseRequestRepository(createPurchaseRequestSchema.parse(input))
  },
}

export const UpdatePurchaseRequest = {
  execute(input: unknown) {
    return updatePurchaseRequestRepository(updatePurchaseRequestSchema.parse(input))
  },
}

export const AddPurchaseRequestItem = {
  execute(input: unknown) {
    return addPurchaseRequestItemRepository(addPurchaseRequestItemSchema.parse(input))
  },
}

export const UpdatePurchaseRequestItem = {
  execute(input: unknown) {
    return updatePurchaseRequestItemRepository(updatePurchaseRequestItemSchema.parse(input))
  },
}

export const RemovePurchaseRequestItem = {
  execute(input: unknown) {
    return removePurchaseRequestItemRepository(removePurchaseRequestItemSchema.parse(input))
  },
}

export const SubmitPurchaseRequest = {
  execute(input: unknown) {
    return submitPurchaseRequestRepository(purchaseRequestCommandSchema.parse(input))
  },
}

export const ApproveTechnicalReview = {
  execute(input: unknown) {
    return approveTechnicalReviewRepository(purchaseRequestDecisionSchema.parse(input))
  },
}

export const ApproveFinancialReview = {
  execute(input: unknown) {
    return approveFinancialReviewRepository(purchaseRequestDecisionSchema.parse(input))
  },
}

export const ApproveExecutiveReview = {
  execute(input: unknown) {
    return approveExecutiveReviewRepository(purchaseRequestDecisionSchema.parse(input))
  },
}

export const ReturnPurchaseRequest = {
  execute(input: unknown) {
    return returnPurchaseRequestRepository(purchaseRequestDecisionSchema.parse(input))
  },
}

export const RejectPurchaseRequest = {
  execute(input: unknown) {
    return rejectPurchaseRequestRepository(purchaseRequestDecisionSchema.parse(input))
  },
}

export const CancelPurchaseRequest = {
  execute(input: unknown) {
    return cancelPurchaseRequestRepository(purchaseRequestCommandSchema.parse(input))
  },
}

export const GetPurchaseRequest = {
  execute(id: unknown) {
    return getPurchaseRequestRepository(uuidSchema.parse(id))
  },
}

export const ListPurchaseRequests = {
  execute(filters: unknown = {}) {
    return listPurchaseRequestsRepository(purchaseRequestFiltersSchema.parse(filters))
  },
}

export const ListPendingApprovals = {
  execute() {
    return listPendingApprovalsRepository()
  },
}

export const ListPurchaseRequestItems = {
  execute(id: unknown) {
    return listPurchaseRequestItemsRepository(uuidSchema.parse(id))
  },
}

export const ListPurchaseRequestDecisions = {
  execute(id: unknown) {
    return listPurchaseRequestDecisionsRepository(uuidSchema.parse(id))
  },
}

export const ListPurchaseRequestAudit = {
  execute(id: unknown) {
    return listPurchaseRequestAuditRepository(uuidSchema.parse(id))
  },
}

export const GetProcurementPermissions = {
  execute() {
    return getProcurementPermissionsRepository()
  },
}

export const GetApprovalSettings = {
  execute() {
    return getApprovalSettingsRepository()
  },
}

export const UpdateApprovalSettings = {
  execute(input: unknown) {
    return updateApprovalSettingsRepository(approvalSettingsSchema.parse(input))
  },
}
