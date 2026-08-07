export const projectStatuses = [
  'draft',
  'active',
  'suspended',
  'closed',
  'cancelled',
] as const

export type ProjectStatus = (typeof projectStatuses)[number]

export type Project = {
  id: string
  companyId: string
  code: string
  name: string
  clientName: string | null
  location: string | null
  startDate: string | null
  endDate: string | null
  status: ProjectStatus
  createdBy: string
  createdAt: string
  updatedAt: string
  version: number
}

export function canActivateProject(status: ProjectStatus) {
  return status === 'draft'
}

export function canSuspendProject(status: ProjectStatus) {
  return status === 'active'
}

export function canCloseProject(status: ProjectStatus) {
  return status === 'active' || status === 'suspended'
}

export function canEditProject(status: ProjectStatus) {
  return status !== 'closed' && status !== 'cancelled'
}
