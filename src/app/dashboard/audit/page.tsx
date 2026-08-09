import { notFound } from 'next/navigation'

import { DataTable, EmptyState, PageHeader } from '@/components/atlas/ui'
import { listCompanyAuditRepository } from '@/modules/identity/admin/infrastructure/admin-repository'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  const access = await requireProcurementAccess()
  if (access.membership.role !== 'administrator') notFound()
  const entries = await listCompanyAuditRepository(150)

  return (
    <main>
      <PageHeader description="Registo operacional da empresa: quem fez o quê e quando." title="Auditoria" />
      <section className="mt-5 border-y border-[var(--border)]">
        {entries.length === 0 ? <EmptyState description="A atividade auditável aparecerá aqui à medida que a equipa utilizar o Atlas." title="Sem atividade registada" /> : (
          <DataTable minWidth={900}>
            <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]"><tr><th className="px-2 py-3 font-medium">Quando</th><th className="px-3 py-3 font-medium">Utilizador</th><th className="px-3 py-3 font-medium">Ação</th><th className="px-3 py-3 font-medium">Módulo</th><th className="px-2 py-3 font-medium">Recurso</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {entries.map((entry) => <tr key={entry.id}><td className="atlas-tabular px-2 py-3 text-[var(--text-muted)]">{new Date(entry.createdAt).toLocaleString('pt-PT')}</td><td className="px-3 py-3">{entry.userName ?? 'Sistema'}</td><td className="px-3 py-3 font-medium">{entry.action}</td><td className="px-3 py-3 text-[var(--text-secondary)]">{entry.module}</td><td className="px-2 py-3 text-[var(--text-secondary)]">{entry.resourceType}</td></tr>)}
            </tbody>
          </DataTable>
        )}
      </section>
    </main>
  )
}
