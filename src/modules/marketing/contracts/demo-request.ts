import { z } from 'zod'

const phonePattern = /^[+0-9().\s-]+$/

export const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  email: z.email().max(254),
  phone: z.string().trim().min(7).max(40).regex(phonePattern),
  role: z.string().trim().min(2).max(100),
  message: z.string().trim().max(2000).optional().default(''),
})

export type DemoRequestInput = z.infer<typeof demoRequestSchema>

export type DemoRequestFormState = {
  status: 'idle' | 'success' | 'error'
  message: string
  fieldErrors?: Partial<Record<keyof DemoRequestInput, string>>
}
