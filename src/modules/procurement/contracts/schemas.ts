import { z } from 'zod'

import {
  purchaseRequestCurrencies,
  purchaseRequestPriorities,
  purchaseRequestStatuses,
} from '../domain/purchase-request'

export const purchaseRequestCurrencySchema = z.enum(purchaseRequestCurrencies)
export const purchaseRequestPrioritySchema = z.enum(purchaseRequestPriorities)
export const purchaseRequestStatusSchema = z.enum(purchaseRequestStatuses)

export const purchaseRequestItemInputSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().max(1_000_000_000),
  unit: z.string().trim().min(1).max(40),
  estimatedUnitPrice: z.coerce.number().min(0).max(1_000_000_000_000),
})

export const createPurchaseRequestSchema = z.object({
  projectId: z.string().uuid(),
  purpose: z.string().trim().min(2).max(2000),
  priority: purchaseRequestPrioritySchema,
  requiredDate: z.iso.date(),
  currency: purchaseRequestCurrencySchema,
  items: z.array(purchaseRequestItemInputSchema).max(100),
})

export const updatePurchaseRequestSchema = createPurchaseRequestSchema.omit({
  items: true,
}).extend({
  purchaseRequestId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
})

export const addPurchaseRequestItemSchema = purchaseRequestItemInputSchema.extend({
  purchaseRequestId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
})

export const updatePurchaseRequestItemSchema = addPurchaseRequestItemSchema.extend({
  itemId: z.string().uuid(),
})

export const removePurchaseRequestItemSchema = z.object({
  purchaseRequestId: z.string().uuid(),
  itemId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
})

export const purchaseRequestCommandSchema = z.object({
  purchaseRequestId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
})

export const purchaseRequestDecisionSchema = purchaseRequestCommandSchema.extend({
  comment: z.string().trim().max(2000).optional().default(''),
})

export const purchaseRequestFiltersSchema = z.object({
  status: purchaseRequestStatusSchema.optional(),
  projectId: z.string().uuid().optional(),
  priority: purchaseRequestPrioritySchema.optional(),
})

export const approvalSettingsSchema = z.object({
  threshold: z.coerce.number().min(0).max(1_000_000_000_000_000),
  currency: purchaseRequestCurrencySchema,
})
