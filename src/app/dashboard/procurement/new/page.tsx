import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ListProjects } from '@/modules/projects/application/use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { createPurchaseRequestAction } from '@/modules/procurement/presentation/actions'
import { getProcurementError } from '@/modules/procurement/presentation/feedback'
import { PurchaseRequestCreateForm } from '@/modules/procurement/presentation/purchase-request-form'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ error?: string | string[] }> }

export default async function NewPurchaseRequestPage({ searchParams }: Props) {
  const access = await requireProcurementAccess()
  if (!access.can('Procurement.Create')) redirect('/dashboard/procurement?error=permission_denied')

  const projects = (await ListProjects.execute()).filter((project) => project.status === 'active')
  const query = await searchParams
  const error = getProcurementError(query.error)

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-5xl">
        <header className="border-b border-zinc-800 pb-8">
          <Link className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300" href="/dashboard/procurement">Procurement</Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Nova solicitação de compra</h1>
          <p className="mt-2 text-sm text-zinc-400">A solicitação começa em draft e só pode ser submetida com pelo menos um item.</p>
        </header>

        {error ? <div className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">{error}</div> : null}

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">
          {projects.length === 0 ? (
            <div>
              <p className="text-sm text-zinc-300">É necessário ter pelo menos um projeto ativo.</p>
              <Link className="mt-4 inline-block text-sm underline text-zinc-400" href="/dashboard/projects">Ir para Projetos</Link>
            </div>
          ) : (
            <PurchaseRequestCreateForm action={createPurchaseRequestAction} projects={projects.map((project) => ({ id: project.id, code: project.code, name: project.name }))} />
          )}
        </div>
      </section>
    </main>
  )
}
