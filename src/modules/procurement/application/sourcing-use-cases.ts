import { getComparisonHighlights } from '../domain/sourcing'
import {
  addQuotationItemRepository,
  createQuotationRepository,
  createSupplierRepository,
  getQuotationRepository,
  getSupplierRepository,
  getSupplierSelectionRepository,
  listPurchaseRequestQuotationsRepository,
  listQuotationItemsRepository,
  listSuppliersRepository,
  removeQuotationItemRepository,
  selectSupplierRepository,
  setSupplierStatusRepository,
  submitQuotationRepository,
  updateQuotationItemRepository,
  updateQuotationRepository,
  updateSupplierRepository,
} from '../infrastructure/sourcing-repository'

export const CreateSupplier = createSupplierRepository
export const UpdateSupplier = updateSupplierRepository
export const ActivateSupplier = (input: { supplierId: string; expectedVersion: number }) =>
  setSupplierStatusRepository('activate_supplier', input)
export const DeactivateSupplier = (input: { supplierId: string; expectedVersion: number }) =>
  setSupplierStatusRepository('deactivate_supplier', input)
export const BlockSupplier = (input: { supplierId: string; expectedVersion: number }) =>
  setSupplierStatusRepository('block_supplier', input)
export const GetSupplier = getSupplierRepository
export const ListSuppliers = listSuppliersRepository

export const CreateQuotation = createQuotationRepository
export const UpdateQuotation = updateQuotationRepository
export const AddQuotationItem = addQuotationItemRepository
export const UpdateQuotationItem = updateQuotationItemRepository
export const RemoveQuotationItem = removeQuotationItemRepository
export const SubmitQuotation = submitQuotationRepository
export const ListQuotationsForPurchaseRequest = listPurchaseRequestQuotationsRepository
export const GetQuotation = getQuotationRepository
export const ListQuotationItems = listQuotationItemsRepository
export const GetSupplierSelection = getSupplierSelectionRepository
export const SelectSupplier = selectSupplierRepository

export async function GetQuotationComparison(purchaseRequestId: string) {
  const quotations = await ListQuotationsForPurchaseRequest(purchaseRequestId)
  const highlights = getComparisonHighlights(
    quotations.map((quotation) => ({
      id: quotation.id,
      currency: quotation.currency,
      total: quotation.total,
      deliveryDays: quotation.deliveryDays,
      coveragePercent: quotation.coveragePercent ?? 0,
    })),
  )

  return { quotations, highlights }
}
