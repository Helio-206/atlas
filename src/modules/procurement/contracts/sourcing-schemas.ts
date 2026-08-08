import { z } from 'zod'

import { purchaseRequestCurrencies } from '../domain/purchase-request'

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null)

export const supplierSchema = z.object({
  name: z.string().trim().min(1).max(200),
  taxNumber: optionalText(64),
  email: z
    .string()
    .trim()
    .max(320)
    .refine((value) => value === '' || z.email().safeParse(value).success, 'Invalid email')
    .transform((value) => value || null),
  phone: optionalText(80),
  address: optionalText(1000),
})

export const supplierUpdateSchema = supplierSchema.extend({
  supplierId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
})

export const supplierStatusSchema = z.object({
  supplierId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
})

export const quotationItemSchema = z.object({
  purchaseRequestItemId: z.string().uuid(),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(40),
  unitPrice: z.coerce.number().min(0),
})

export const quotationSchema = z.object({
  purchaseRequestId: z.string().uuid(),
  supplierId: z.string().uuid(),
  quotationNumber: optionalText(120),
  currency: z.enum(purchaseRequestCurrencies),
  taxAmount: z.coerce.number().min(0).default(0),
  validUntil: z.string().trim().transform((value) => value || null),
  deliveryDays: z.union([z.literal(''), z.coerce.number().int().min(0)]).transform((value) => value === '' ? null : value),
  paymentTerms: optionalText(1000),
  notes: optionalText(2000),
  items: z.array(quotationItemSchema),
})

export const quotationUpdateSchema = quotationSchema.omit({ purchaseRequestId: true, items: true }).extend({
  quotationId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
})

export const quotationItemMutationSchema = quotationItemSchema.extend({
  quotationId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
})

export const quotationItemUpdateSchema = quotationItemMutationSchema.extend({
  itemId: z.string().uuid(),
})

export const quotationItemRemoveSchema = z.object({
  quotationId: z.string().uuid(),
  itemId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
})

export const quotationSubmitSchema = z.object({
  quotationId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
})

export const supplierSelectionSchema = z.object({
  purchaseRequestId: z.string().uuid(),
  quotationId: z.string().uuid(),
  expectedRequestVersion: z.coerce.number().int().min(1),
  expectedQuotationVersion: z.coerce.number().int().min(1),
  justification: z.string().trim().min(1).max(2000),
})
