import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  ActivityList,
  DataTable,
  Money,
  PageHeader,
  SectionHeader,
  StatusBadge,
} from '@/components/atlas/ui'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getActiveMembership } from '@/modules/identity/company-onboarding/queries'
import { ListPurchaseOrders } from '@/modules/procurement/application/fulfillment-use-cases'
import {
  ListPendingApprovals,
  ListPurchaseRequests,
} from '@/modules/procurement/application/use-cases'
import { statusLabel } from '@/modules/procurement/presentation/components'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const membership = await getActiveMembership()

  if (!membership) {
    redirect('/onboarding/company')
  }

  const [requests, approvals, orders, companyResult] = await Promise.all([
    ListPurchaseRequests.execute(),
    ListPendingApprovals.execute(),
    ListPurchaseOrders(),
    supabase.schema('identity').from('companies').select('name').eq('id', membership.company_id).maybeSingle(),
  ])

  const now = new Date()
  const openRequests = requests.filter((request) =>
    !['received', 'rejected', 'cancelled'].includes(request.status),
  )
  const partialOrders = orders.filter((order) => order.status === 'partially_received')
  const pendingOrders = orders.filter((order) => ['issued', 'partially_received'].includes(order.status))
  const receivedThisMonth = orders.filter((order) => {
    if (order.status !== 'received') return false
    const date = new Date(order.updatedAt)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  })
  const delayed = requests.filter((request) => {
    const age = now.getTime() - new Date(request.updatedAt).getTime()
    return ['technical_review', 'financial_review', 'executive_review'].includes(request.status) && age > 3 * 86_400_000
  })
  const recentRequests = [...requests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)
  const recentActivity = [
    ...requests.map((request) => ({
      date: new Date(request.createdAt),
      href: `/dashboard/procurement/${request.id}`,
      text: `${request.requesterName ?? 'Utilizador'} criou ${request.requestNumber}`,
    })),
    ...orders.map((order) => ({
      date: new Date(order.issuedAt),
      href: `/dashboard/purchase-orders/${order.id}`,
      text: `${order.orderNumber} foi emitida para ${order.supplierName}`,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5)

  return (
    <main>
      <PageHeader
        description={`Visão operacional da ${companyResult.data?.name ?? 'empresa atual'}.`}
        title="Visão geral"
      />

      <section className="mt-5">
        <SectionHeader title="Requer atenção" />
        <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          <AttentionRow
            href="/dashboard/approvals"
            label={`${approvals.length} solicitações aguardam aprovação`}
            link="Ver aprovações"
          />
          <AttentionRow
            href="/dashboard/purchase-orders"
            label={`${partialOrders.length} ordens de compra têm receção parcial`}
            link="Ver ordens"
          />
          <AttentionRow
            href={delayed[0] ? `/dashboard/procurement/${delayed[0].id}` : '/dashboard/procurement'}
            label={`${delayed.length} solicitações aguardam decisão há mais de 3 dias`}
            link="Ver solicitação"
          />
        </div>
      </section>

      <section aria-label="Estado operacional" className="mt-5 grid grid-cols-2 border-y border-[var(--border)] md:grid-cols-4">
        <OperationalMetric label="Aprovações pendentes" value={approvals.length} />
        <OperationalMetric label="Solicitações em curso" value={openRequests.length} />
        <OperationalMetric label="Ordens por receber" value={pendingOrders.length} />
        <OperationalMetric label="Recebidas este mês" value={receivedThisMonth.length} />
      </section>

      <section className="mt-5">
        <SectionHeader
          action={<Link className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]" href="/dashboard/procurement">Ver todas →</Link>}
          title="Solicitações recentes"
        />
        <div className="mt-3 border-y border-[var(--border)]">
          <DataTable minWidth={820}>
            <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]">
              <tr>
                <th className="px-1 py-3 font-medium">Número</th>
                <th className="px-3 py-3 font-medium">Projeto</th>
                <th className="px-3 py-3 font-medium">Finalidade</th>
                <th className="px-3 py-3 text-right font-medium">Valor</th>
                <th className="px-3 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {recentRequests.map((request) => (
                <tr key={request.id}>
                  <td className="px-1 py-3"><Link className="atlas-link atlas-tabular" href={`/dashboard/procurement/${request.id}`}>{request.requestNumber}</Link></td>
                  <td className="px-3 py-3 text-[var(--text-secondary)]">{request.projectName}</td>
                  <td className="max-w-80 px-3 py-3 text-[var(--text-secondary)]"><span className="line-clamp-1">{request.purpose}</span></td>
                  <td className="px-3 py-3 text-right"><Money currency={request.currency} value={request.estimatedTotal} /></td>
                  <td className="px-3 py-3"><StatusBadge label={statusLabel(request.status)} tone={statusTone(request.status)} /></td>
                </tr>
              ))}
              {recentRequests.length === 0 ? <tr><td className="py-8 text-center text-[var(--text-muted)]" colSpan={5}>Ainda não existem solicitações.</td></tr> : null}
            </tbody>
          </DataTable>
        </div>
      </section>

      <section className="mt-5">
        <SectionHeader title="Atividade recente" />
        <div className="mt-2">
          <ActivityList items={recentActivity.map((item) => ({
            href: item.href,
            text: item.text,
            time: activityTime(item.date, now),
          }))} />
        </div>
      </section>
    </main>
  )
}

function AttentionRow({ href, label, link }: { href: string; label: string; link: string }) {
  return (
    <Link className="grid min-h-12 grid-cols-[1fr_auto] items-center gap-6 py-2 text-[12px] hover:bg-[var(--surface-subtle)]" href={href}>
      <span>{label}</span>
      <span className="text-[var(--text-secondary)]">{link} →</span>
    </Link>
  )
}

function OperationalMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-[var(--border)] px-4 py-4 last:border-r-0 md:px-8">
      <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
      <p className="atlas-tabular mt-1 text-[22px] font-medium">{value}</p>
    </div>
  )
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (['approved', 'received', 'supplier_selected'].includes(status)) return 'success'
  if (['rejected', 'cancelled'].includes(status)) return 'danger'
  if (['financial_review', 'executive_review', 'partially_received'].includes(status)) return 'warning'
  if (['technical_review', 'submitted', 'ordered'].includes(status)) return 'info'
  return 'neutral'
}

function activityTime(date: Date, now: Date) {
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
}
