import Link from 'next/link'

import { ListPendingApprovals } from '@/modules/procurement/application/use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { formatMoney, PurchaseRequestStatusBadge } from '@/modules/procurement/presentation/components'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  await requireProcurementAccess()
  const approvals = await ListPendingApprovals.execute()

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-5xl">
        <header className="border-b border-zinc-800 pb-8">
          <Link className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300" href="/dashboard/procurement">Procurement</Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Inbox de aprovações</h1>
          <p className="mt-2 text-sm text-zinc-400">Apenas solicitações em que a sua role pode agir aparecem aqui.</p>
        </header>

        <div className="mt-8 space-y-4">
          {approvals.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-sm text-zinc-400">Não existem aprovações pendentes para si.</div>
          ) : approvals.map((request) => (
            <Link className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700" href={`/dashboard/procurement/${request.id}`} key={request.id}>
              <div>
                <p className="font-mono text-sm text-zinc-300">{request.requestNumber}</p>
                <h2 className="mt-2 font-semibold">{request.projectName}</h2>
                <p className="mt-1 text-sm text-zinc-400">{request.requesterName ?? 'Utilizador'} · {request.purpose}</p>
              </div>
              <div className="text-right">
                <p className="mb-2 font-medium">{formatMoney(request.estimatedTotal, request.currency)}</p>
                <PurchaseRequestStatusBadge status={request.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
