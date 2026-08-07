import Link from 'next/link'

import { createProjectAction } from '@/modules/projects/presentation/actions'
import { requireProjectsAccess } from '@/modules/projects/presentation/access'
import { getProjectError } from '@/modules/projects/presentation/feedback'
import { ProjectForm } from '@/modules/projects/presentation/project-components'

export const dynamic = 'force-dynamic'

type NewProjectPageProps = {
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function NewProjectPage({
  searchParams,
}: NewProjectPageProps) {
  await requireProjectsAccess()
  const params = await searchParams
  const error = getProjectError(params.error)

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-3xl">
        <header className="border-b border-zinc-800 pb-8">
          <Link
            className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300"
            href="/dashboard/projects"
          >
            Projetos
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Novo projeto
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            O projeto será criado em estado draft na empresa ativa da sessão.
          </p>
        </header>

        {error ? (
          <div
            className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">
          <ProjectForm
            action={createProjectAction}
            submitLabel="Criar projeto"
          />
        </div>
      </section>
    </main>
  )
}
