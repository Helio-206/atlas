'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  createProjectSchema,
  transitionProjectSchema,
  updateProjectSchema,
} from '../contracts/schemas'
import { ProjectRepositoryError } from '../infrastructure/project-repository'
import {
  ActivateProject,
  CloseProject,
  CreateProject,
  SuspendProject,
  UpdateProject,
} from '../application/use-cases'

function formValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function projectFields(formData: FormData) {
  return {
    code: formValue(formData, 'code'),
    name: formValue(formData, 'name'),
    clientName: formValue(formData, 'client_name'),
    location: formValue(formData, 'location'),
    startDate: formValue(formData, 'start_date'),
    endDate: formValue(formData, 'end_date'),
  }
}

function repositoryMessage(error: unknown) {
  return error instanceof ProjectRepositoryError ? error.message : ''
}

function projectErrorRedirect(projectId: string, error: unknown): never {
  const message = repositoryMessage(error)

  if (message.includes('project_not_found')) {
    redirect('/dashboard/projects?error=project_not_found')
  }

  if (message.includes('project_version_conflict')) {
    redirect(`/dashboard/projects/${projectId}?error=version_conflict`)
  }

  if (message.includes('duplicate_project_code')) {
    redirect(`/dashboard/projects/${projectId}?error=duplicate_code`)
  }

  if (message.includes('project_not_editable')) {
    redirect(`/dashboard/projects/${projectId}?error=not_editable`)
  }

  if (message.includes('invalid_project_transition')) {
    redirect(`/dashboard/projects/${projectId}?error=invalid_transition`)
  }

  redirect(`/dashboard/projects/${projectId}?error=command_failed`)
}

export async function createProjectAction(formData: FormData) {
  const parsed = createProjectSchema.safeParse(projectFields(formData))

  if (!parsed.success) {
    redirect('/dashboard/projects/new?error=invalid_form')
  }

  let projectId: string

  try {
    projectId = await CreateProject.execute(parsed.data)
  } catch (error) {
    const message = repositoryMessage(error)

    if (message.includes('duplicate_project_code')) {
      redirect('/dashboard/projects/new?error=duplicate_code')
    }

    redirect('/dashboard/projects/new?error=creation_failed')
  }

  revalidatePath('/dashboard/projects')
  redirect(`/dashboard/projects/${projectId}?notice=created`)
}

export async function updateProjectAction(formData: FormData) {
  const parsed = updateProjectSchema.safeParse({
    projectId: formValue(formData, 'project_id'),
    expectedVersion: formValue(formData, 'expected_version'),
    ...projectFields(formData),
  })

  const projectId = formValue(formData, 'project_id')

  if (!parsed.success) {
    if (projectId) {
      redirect(`/dashboard/projects/${projectId}?error=invalid_form`)
    }

    redirect('/dashboard/projects?error=invalid_form')
  }

  try {
    await UpdateProject.execute(parsed.data)
  } catch (error) {
    projectErrorRedirect(parsed.data.projectId, error)
  }

  revalidatePath('/dashboard/projects')
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`)
  redirect(`/dashboard/projects/${parsed.data.projectId}?notice=updated`)
}

async function transitionAction(
  formData: FormData,
  command: typeof ActivateProject | typeof SuspendProject | typeof CloseProject,
  notice: 'activated' | 'suspended' | 'closed',
) {
  const parsed = transitionProjectSchema.safeParse({
    projectId: formValue(formData, 'project_id'),
    expectedVersion: formValue(formData, 'expected_version'),
  })

  if (!parsed.success) {
    redirect('/dashboard/projects?error=invalid_command')
  }

  try {
    await command.execute(parsed.data)
  } catch (error) {
    projectErrorRedirect(parsed.data.projectId, error)
  }

  revalidatePath('/dashboard/projects')
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`)
  redirect(`/dashboard/projects/${parsed.data.projectId}?notice=${notice}`)
}

export async function activateProjectAction(formData: FormData) {
  return transitionAction(formData, ActivateProject, 'activated')
}

export async function suspendProjectAction(formData: FormData) {
  return transitionAction(formData, SuspendProject, 'suspended')
}

export async function closeProjectAction(formData: FormData) {
  return transitionAction(formData, CloseProject, 'closed')
}
