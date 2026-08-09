import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Breadcrumbs, PageHeader } from '@/components/atlas/ui'
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
    <main>
      <Breadcrumbs items={[{ label: 'Compras' }, { label: 'Solicitações', href: '/dashboard/procurement' }, { label: 'Nova solicitação' }]} />
      <div className="atlas-document-sheet atlas-document-sheet-header">
        <PageHeader description="A solicitação começa como rascunho e só pode ser submetida com pelo menos um item." title="Nova solicitação de compra" />
      </div>

      {error ? <div className="atlas-notice atlas-notice-error mt-5" role="alert">{error}</div> : null}

      <div className="atlas-document-form mt-6">
        {projects.length === 0 ? (
          <div>
            <p className="text-[13px] text-[var(--text-secondary)]">É necessário ter pelo menos um projeto ativo.</p>
            <Link className="atlas-link mt-4 inline-block text-[13px]" href="/dashboard/projects">Ir para Projetos</Link>
          </div>
        ) : (
          <PurchaseRequestCreateForm action={createPurchaseRequestAction} projects={projects.map((project) => ({ id: project.id, code: project.code, name: project.name }))} />
        )}
      </div>
    </main>
  )
}
