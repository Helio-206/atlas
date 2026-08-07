import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'

import { GetProject } from '@/modules/projects/application/use-cases'
import { canEditProject } from '@/modules/projects/domain/project'
import { requireProjectsAccess } from '@/modules/projects/presentation/access'
import {
  getProjectError,
  getProjectNotice,
} from '@/modules/projects/presentation/feedback'
import {
  ProjectForm,
  ProjectStateActions,
  ProjectStatusBadge,
} from '@/modules/projects/presentation/project-components'
import { updateProjectAction } from '@/modules/projects/presentation/actions'

export const dynamic = 'force-dynamic'

const projectIdSchema = z.string().uuid()

type ProjectPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    error?: string | string[]
    notice?: string | string[]
  }>
}

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  await requireProjectsAccess()

  const { id } = await params
  if (!projectIdSchema.safeParse(id).success) {
    notFound()
  }

  const project = await GetProject.execute(id)
  if (!project) {
    notFound()
  }

  const query = await searchParams
  const error = getProjectError(query.error)
  const notice = getProjectNotice(query.notice)

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-zinc-800 pb-8">
          <div className="min-w-0">
            <Link
              className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300"
              href="/dashboard/projects"
            >
              Projetos
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {project.name}
              </h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-2 font-mono text-sm text-zinc-500">
              {project.code} · versão {project.version}
            </p>
          </div>

          <ProjectStateActions project={project} />
        </header>

        {error ? (
          <div
            className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ProjectMeta label="Cliente" value={project.clientName ?? '—'} />
          <ProjectMeta label="Localização" value={project.location ?? '—'} />
          <ProjectMeta label="Data inicial" value={project.startDate ?? '—'} />
          <ProjectMeta label="Data final" value={project.endDate ?? '—'} />
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">
          <div className="mb-6 border-b border-zinc-800 pb-5">
            <h2 className="text-lg font-semibold">
              {canEditProject(project.status) ? 'Editar projeto' : 'Projeto fechado'}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {canEditProject(project.status)
                ? 'A versão atual é verificada no servidor antes de qualquer alteração.'
                : 'Projetos fechados permanecem disponíveis apenas para consulta.'}
            </p>
          </div>

          {canEditProject(project.status) ? (
            <ProjectForm
              action={updateProjectAction}
              project={project}
              submitLabel="Guardar alterações"
            />
          ) : (
            <p className="text-sm text-zinc-400">
              Não existem comandos de edição disponíveis para este estado.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}

function ProjectMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 truncate text-sm text-zinc-200">{value}</p>
    </div>
  )
}
