import { z } from 'zod'

import { projectStatuses } from '../domain/project'

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value
      }

      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().max(maxLength).nullable(),
  )

const optionalDate = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value
    }

    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  },
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
)

export const projectFieldsSchema = z
  .object({
    code: z.string().trim().min(1).max(64),
    name: z.string().trim().min(2).max(160),
    clientName: optionalText(160),
    location: optionalText(200),
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .refine(
    ({ startDate, endDate }) =>
      !startDate || !endDate || endDate >= startDate,
    {
      message: 'A data final não pode ser anterior à inicial.',
      path: ['endDate'],
    },
  )

export const createProjectSchema = projectFieldsSchema

export const updateProjectSchema = projectFieldsSchema.and(
  z.object({
    projectId: z.string().uuid(),
    expectedVersion: z.coerce.number().int().min(1),
  }),
)

export const transitionProjectSchema = z.object({
  projectId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
})

export const projectRowSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  client_name: z.string().nullable(),
  location: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  status: z.enum(projectStatuses),
  created_by: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int().min(1),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type TransitionProjectInput = z.infer<typeof transitionProjectSchema>
