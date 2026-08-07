import 'server-only'

import { z } from 'zod'

import {
  createProjectSchema,
  transitionProjectSchema,
  updateProjectSchema,
} from '../contracts/schemas'
import {
  activateProjectRepository,
  closeProjectRepository,
  createProjectRepository,
  getProjectRepository,
  listProjectsRepository,
  suspendProjectRepository,
  updateProjectRepository,
} from '../infrastructure/project-repository'

const projectIdSchema = z.string().uuid()

export const CreateProject = {
  execute(input: unknown) {
    return createProjectRepository(createProjectSchema.parse(input))
  },
}

export const UpdateProject = {
  execute(input: unknown) {
    return updateProjectRepository(updateProjectSchema.parse(input))
  },
}

export const ActivateProject = {
  execute(input: unknown) {
    return activateProjectRepository(transitionProjectSchema.parse(input))
  },
}

export const SuspendProject = {
  execute(input: unknown) {
    return suspendProjectRepository(transitionProjectSchema.parse(input))
  },
}

export const CloseProject = {
  execute(input: unknown) {
    return closeProjectRepository(transitionProjectSchema.parse(input))
  },
}

export const GetProject = {
  execute(projectId: unknown) {
    return getProjectRepository(projectIdSchema.parse(projectId))
  },
}

export const ListProjects = {
  execute() {
    return listProjectsRepository()
  },
}
