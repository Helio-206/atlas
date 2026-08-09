import { notFound } from 'next/navigation'

import { DataTable, PageHeader, StatusBadge } from '@/components/atlas/ui'
import { listDemoRequestsRepository } from '@/modules/identity/admin/infrastructure/admin-repository'
import { updateDemoRequestAction } from '@/modules/identity/admin/presentation/actions'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }> }

const statuses = [
  ['new', 'Novo'],
  ['contacted', 'Contactado'],
  ['qualified', 'Qualificado'],
  ['demo_scheduled', 'Demo agendada'],
  ['pilot_proposed', 'Piloto proposto'],
  ['won', 'Ganho'],
  ['lost', 'Perdido'],
] as const

export default async function DemoRequestsPage({ searchParams }: Props) {
  const access = await requireProcurementAccess()
  if (access.membership.role !== 'administrator') notFound()

  const [requests, query] = await Promise.all([listDemoRequestsRepository(), searchParams])
  const error = first(query.error)
  const notice = first(query.notice)

  return (
    <main>
      <PageHeader
        description="Pedidos recebidos pela landing. Dados visíveis apenas a administradores autorizados."
        title="Pedidos de demonstração"
      />
      {error ? <div className="atlas-notice atlas-notice-error mt-4" role="alert">Não foi possível guardar este pedido.</div> : null}
      {notice ? <div className="atlas-notice mt-4" role="status">Pedido atualizado.</div> : null}

      <section className="mt-5" data-atlas-motion="paper">
        <DataTable minWidth={1320} surface="paper">
          <thead>
            <tr>
              <th className="atlas-document-sheet-header px-3 py-3 font-medium">Contacto</th>
              <th className="atlas-document-sheet-header px-3 py-3 font-medium">Empresa</th>
              <th className="atlas-document-sheet-header px-3 py-3 font-medium">Função</th>
              <th className="atlas-document-sheet-header px-3 py-3 font-medium">Recebido</th>
              <th className="atlas-document-sheet-header px-3 py-3 font-medium">Estado</th>
              <th className="atlas-document-sheet-header w-[320px] px-3 py-3 font-medium">Notas internas</th>
              <th className="atlas-document-sheet-header px-3 py-3 text-right font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-[var(--text-muted)]" colSpan={7}>Ainda não existem pedidos de demonstração.</td></tr>
            ) : requests.map((request) => (
              <tr key={request.id}>
                <td className="px-3 py-3 align-top">
                  <p className="font-medium">{request.name}</p>
                  <a className="atlas-link mt-1 block text-[11px]" href={`mailto:${request.email}`}>{request.email}</a>
                  <a className="mt-0.5 block text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]" href={`tel:${request.phone}`}>{request.phone}</a>
                </td>
                <td className="px-3 py-3 align-top text-[var(--text-secondary)]">{request.company}</td>
                <td className="px-3 py-3 align-top text-[var(--text-secondary)]">{request.role}</td>
                <td className="px-3 py-3 align-top text-[11px] text-[var(--text-muted)]">{formatDate(request.createdAt)}</td>
                <td className="px-3 py-3 align-top">
                  <StatusBadge label={statusLabel(request.status)} tone={statusTone(request.status)} />
                </td>
                <td className="px-3 py-3 align-top">
                  <form action={updateDemoRequestAction} className="space-y-2" id={`demo-request-${request.id}`}>
                    <input name="demo_request_id" type="hidden" value={request.id} />
                    <input name="expected_updated_at" type="hidden" value={request.updatedAt} />
                    <label className="sr-only" htmlFor={`status-${request.id}`}>Estado de {request.name}</label>
                    <select className="atlas-input w-full" defaultValue={request.status} id={`status-${request.id}`} name="status">
                      {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <label className="sr-only" htmlFor={`notes-${request.id}`}>Notas internas de {request.name}</label>
                    <textarea className="atlas-input min-h-16 w-full resize-y" defaultValue={request.internalNotes ?? ''} id={`notes-${request.id}`} maxLength={4000} name="internal_notes" placeholder="Nota interna" rows={2} />
                  </form>
                </td>
                <td className="px-3 py-3 text-right align-top">
                  <button className="atlas-button atlas-button-primary text-[11px]" formAction={updateDemoRequestAction} form={`demo-request-${request.id}`} type="submit">Guardar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </section>
    </main>
  )
}

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function statusLabel(status: string) {
  return statuses.find(([value]) => value === status)?.[1] ?? status
}

function statusTone(status: string) {
  if (status === 'won') return 'success' as const
  if (status === 'lost') return 'danger' as const
  if (status === 'new' || status === 'demo_scheduled' || status === 'pilot_proposed') return 'info' as const
  return 'neutral' as const
}
