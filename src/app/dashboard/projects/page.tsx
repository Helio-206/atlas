import Link from 'next/link'

import { ListProjects } from '@/modules/projects/application/use-cases'
import {
  getProjectError,
  getProjectNotice,
} from '@/modules/projects/presentation/feedback'
import { requireProjectsAccess } from '@/modules/projects/presentation/access'
import { ProjectStatusBadge } from '@/modules/projects/presentation/project-components'

export const dynamic = 'force-dynamic'

type ProjectsPageProps = {
  searchParams: Promise<{
    error?: string | string[]
    notice?: string | string[]
  }>
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  await requireProjectsAccess()
  const projects = await ListProjects.execute()
  const params = await searchParams
  const error = getProjectError(params.error)
  const notice = getProjectNotice(params.notice)

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-zinc-800 pb-8">
          <div>
            <Link
              className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300"
              href="/dashboard"
            >
              Atlas · Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Projetos
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Projetos da empresa ativa nesta sessão.
            </p>
          </div>

          <Link
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white"
            href="/dashboard/projects/new"
          >
            Novo projeto
          </Link>
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

        {projects.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-800 p-10 text-center">
            <h2 className="text-lg font-semibold">Ainda não existem projetos</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Crie o primeiro projeto para iniciar a operação da empresa.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-800">
            <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)_auto] gap-4 border-b border-zinc-800 bg-zinc-900 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <span>Código</span>
              <span>Projeto</span>
              <span>Estado</span>
            </div>

            {projects.map((project) => (
              <Link
                className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)_auto] items-center gap-4 border-b border-zinc-800 px-5 py-4 transition last:border-b-0 hover:bg-zinc-900/70"
                href={`/dashboard/projects/${project.id}`}
                key={project.id}
              >
                <span className="truncate font-mono text-sm text-zinc-400">
                  {project.code}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {project.name}
                  </span>
                  <span className="mt-1 block truncate text-xs text-zinc-500">
                    {project.clientName ?? 'Sem cliente definido'}
                  </span>
                </span>
                <ProjectStatusBadge status={project.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
