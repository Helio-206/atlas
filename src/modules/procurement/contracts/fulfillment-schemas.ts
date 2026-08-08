import { z } from 'zod'

const nullableText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null)

export const issuePurchaseOrderSchema = z.object({
  purchaseRequestId: z.string().uuid(),
  expectedRequestVersion: z.coerce.number().int().min(1),
})

export const goodsReceiptItemSchema = z.object({
  purchaseOrderItemId: z.string().uuid(),
  quantityReceived: z.coerce.number().positive(),
})

export const recordGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
  notes: nullableText(2000),
  items: z.array(goodsReceiptItemSchema).min(1),
})
