import {
  getGoodsReceiptRepository,
  getPurchaseOrderForPurchaseRequestRepository,
  getPurchaseOrderReceiptStatusRepository,
  getPurchaseOrderRepository,
  issuePurchaseOrderRepository,
  listGoodsReceiptItemsRepository,
  listGoodsReceiptsRepository,
  listPurchaseOrderAuditRepository,
  listPurchaseOrderItemsRepository,
  listPurchaseOrdersRepository,
  recordGoodsReceiptRepository,
} from '../infrastructure/fulfillment-repository'

export const IssuePurchaseOrder = issuePurchaseOrderRepository
export const GetPurchaseOrder = getPurchaseOrderRepository
export const ListPurchaseOrders = listPurchaseOrdersRepository
export const GetPurchaseOrderForPurchaseRequest = getPurchaseOrderForPurchaseRequestRepository
export const ListPurchaseOrderItems = listPurchaseOrderItemsRepository

export const RecordGoodsReceipt = recordGoodsReceiptRepository
export const GetGoodsReceipt = getGoodsReceiptRepository
export const ListGoodsReceipts = listGoodsReceiptsRepository
export const ListGoodsReceiptItems = listGoodsReceiptItemsRepository

export const GetPurchaseOrderReceiptStatus = getPurchaseOrderReceiptStatusRepository
export const ListPurchaseOrderAudit = listPurchaseOrderAuditRepository
