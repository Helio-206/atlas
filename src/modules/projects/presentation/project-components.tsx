import Link from 'next/link'

import type { Project, ProjectStatus } from '../domain/project'
import {
  canActivateProject,
  canCloseProject,
  canSuspendProject,
} from '../domain/project'
import {
  activateProjectAction,
  closeProjectAction,
  suspendProjectAction,
} from './actions'

const inputClassName =
  'mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500'

const statusLabels: Record<ProjectStatus, string> = {
  draft: 'Draft',
  active: 'Ativo',
  suspended: 'Suspenso',
  closed: 'Fechado',
  cancelled: 'Cancelado',
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300">
      {statusLabels[status]}
    </span>
  )
}

type ProjectFormProps = {
  action: (formData: FormData) => Promise<unknown>
  project?: Project
  submitLabel: string
}

export function ProjectForm({ action, project, submitLabel }: ProjectFormProps) {
  return (
    <form action={action} className="space-y-5">
      {project ? (
        <>
          <input name="project_id" type="hidden" value={project.id} />
          <input
            name="expected_version"
            type="hidden"
            value={project.version}
          />
        </>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-medium" htmlFor="code">
          Código
          <input
            className={inputClassName}
            defaultValue={project?.code}
            id="code"
            maxLength={64}
            name="code"
            required
          />
        </label>

        <label className="block text-sm font-medium" htmlFor="name">
          Nome
          <input
            className={inputClassName}
            defaultValue={project?.name}
            id="name"
            maxLength={160}
            minLength={2}
            name="name"
            required
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-medium" htmlFor="client_name">
          Cliente
          <input
            className={inputClassName}
            defaultValue={project?.clientName ?? ''}
            id="client_name"
            maxLength={160}
            name="client_name"
          />
        </label>

        <label className="block text-sm font-medium" htmlFor="location">
          Localização
          <input
            className={inputClassName}
            defaultValue={project?.location ?? ''}
            id="location"
            maxLength={200}
            name="location"
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-medium" htmlFor="start_date">
          Data inicial
          <input
            className={inputClassName}
            defaultValue={project?.startDate ?? ''}
            id="start_date"
            name="start_date"
            type="date"
          />
        </label>

        <label className="block text-sm font-medium" htmlFor="end_date">
          Data final
          <input
            className={inputClassName}
            defaultValue={project?.endDate ?? ''}
            id="end_date"
            name="end_date"
            type="date"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-4 pt-2">
        <Link
          className="text-sm font-medium text-zinc-400 hover:text-zinc-200"
          href={project ? `/dashboard/projects/${project.id}` : '/dashboard/projects'}
        >
          Cancelar
        </Link>
        <button
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white"
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

export function ProjectStateActions({ project }: { project: Project }) {
  const actionClassName =
    'rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium transition hover:border-zinc-500 hover:bg-zinc-900'

  return (
    <div className="flex flex-wrap gap-3">
      {canActivateProject(project.status) ? (
        <form action={activateProjectAction}>
          <input name="project_id" type="hidden" value={project.id} />
          <input
            name="expected_version"
            type="hidden"
            value={project.version}
          />
          <button className={actionClassName} type="submit">
            Ativar projeto
          </button>
        </form>
      ) : null}

      {canSuspendProject(project.status) ? (
        <form action={suspendProjectAction}>
          <input name="project_id" type="hidden" value={project.id} />
          <input
            name="expected_version"
            type="hidden"
            value={project.version}
          />
          <button className={actionClassName} type="submit">
            Suspender projeto
          </button>
        </form>
      ) : null}

      {canCloseProject(project.status) ? (
        <form action={closeProjectAction}>
          <input name="project_id" type="hidden" value={project.id} />
          <input
            name="expected_version"
            type="hidden"
            value={project.version}
          />
          <button className={actionClassName} type="submit">
            Encerrar projeto
          </button>
        </form>
      ) : null}
    </div>
  )
}
