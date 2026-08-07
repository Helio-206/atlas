import 'server-only'

import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import type { Project } from '../domain/project'
import {
  type CreateProjectInput,
  projectRowSchema,
  type TransitionProjectInput,
  type UpdateProjectInput,
} from '../contracts/schemas'

const projectRowsSchema = z.array(projectRowSchema)
const projectIdSchema = z.string().uuid()
const projectVersionSchema = z.number().int().min(1)

export class ProjectRepositoryError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ProjectRepositoryError'
  }
}

function toProject(row: z.infer<typeof projectRowSchema>): Project {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    clientName: row.client_name,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  }
}

function throwRepositoryError(error: { code?: string; message: string }): never {
  throw new ProjectRepositoryError(error.code ?? 'unknown', error.message)
}

export async function createProjectRepository(input: CreateProjectInput) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('create_project', {
    code: input.code,
    name: input.name,
    client_name: input.clientName,
    location: input.location,
    start_date: input.startDate,
    end_date: input.endDate,
  })

  if (error) {
    throwRepositoryError(error)
  }

  return projectIdSchema.parse(data)
}

export async function updateProjectRepository(input: UpdateProjectInput) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('update_project', {
    project_id: input.projectId,
    expected_version: input.expectedVersion,
    code: input.code,
    name: input.name,
    client_name: input.clientName,
    location: input.location,
    start_date: input.startDate,
    end_date: input.endDate,
  })

  if (error) {
    throwRepositoryError(error)
  }

  return projectVersionSchema.parse(data)
}

async function transitionProjectRepository(
  command: 'activate_project' | 'suspend_project' | 'close_project',
  input: TransitionProjectInput,
) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc(command, {
    project_id: input.projectId,
    expected_version: input.expectedVersion,
  })

  if (error) {
    throwRepositoryError(error)
  }

  return projectVersionSchema.parse(data)
}

export function activateProjectRepository(input: TransitionProjectInput) {
  return transitionProjectRepository('activate_project', input)
}

export function suspendProjectRepository(input: TransitionProjectInput) {
  return transitionProjectRepository('suspend_project', input)
}

export function closeProjectRepository(input: TransitionProjectInput) {
  return transitionProjectRepository('close_project', input)
}

export async function getProjectRepository(projectId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_project', {
    project_id: projectId,
  })

  if (error) {
    throwRepositoryError(error)
  }

  const rows = projectRowsSchema.parse(data ?? [])
  const project = rows.at(0)
  return project ? toProject(project) : null
}

export async function listProjectsRepository() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_projects')

  if (error) {
    throwRepositoryError(error)
  }

  return projectRowsSchema.parse(data ?? []).map(toProject)
}
