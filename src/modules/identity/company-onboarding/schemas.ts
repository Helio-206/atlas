import { z } from 'zod'

export const companyOnboardingSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, 'O nome da empresa deve ter pelo menos 2 caracteres.')
    .max(160, 'O nome da empresa não pode exceder 160 caracteres.'),
  companyTaxNumber: z
    .string()
    .trim()
    .max(64, 'O NIF não pode exceder 64 caracteres.')
    .optional()
    .transform((value) => value || null),
})
