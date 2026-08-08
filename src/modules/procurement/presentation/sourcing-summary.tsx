import Link from 'next/link'

import {
  GetSupplierSelection,
  ListQuotationsForPurchaseRequest,
} from '../application/sourcing-use-cases'
import type { ProcurementPermission } from '../domain/permissions'
import { formatMoney } from './components'

export async function SourcingSummary({
  requestId,
  permissions,
}: {
  requestId: string
  permissions: ProcurementPermission[]
}) {
  if (!permissions.includes('Procurement.QuotationView')) return null

  const [quotations, selection] = await Promise.all([
    ListQuotationsForPurchaseRequest(requestId),
    GetSupplierSelection(requestId),
  ])
  const suppliers = [...new Set(quotations.map((quotation) => quotation.supplierName))]

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Quotations</p>
          <h2 className="mt-2 text-lg font-semibold">Sourcing</h2>
          <p className="mt-1 text-sm text-zinc-400">{quotations.length} cotação(ões) · {suppliers.length} fornecedor(es) participante(s)</p>
        </div>
        <Link className="rounded-lg border border-zinc-700 px-4 py-2 text-sm" href={`/dashboard/procurement/${requestId}/quotations`}>Abrir comparação</Link>
      </div>

      {quotations.length ? <div className="mt-4 flex flex-wrap gap-2">{quotations.map((quotation) => <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300" key={quotation.id}>{quotation.supplierName} · {quotation.status}</span>)}</div> : null}

      {selection ? (
        <div className="mt-6 border-t border-zinc-800 pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Selected Supplier</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3"><div><p className="text-xs text-zinc-500">Supplier</p><p className="mt-1 font-medium">{selection.supplierName}</p></div><div><p className="text-xs text-zinc-500">Quotation</p><p className="mt-1">{selection.quotationNumber ?? 'Sem número'} · {formatMoney(selection.total, selection.currency)}</p></div><div><p className="text-xs text-zinc-500">Selected By / Date</p><p className="mt-1 text-sm">{selection.selectedByName ?? selection.selectedBy} · {new Date(selection.selectedAt).toLocaleString('pt-PT')}</p></div></div>
          <p className="mt-4 text-sm text-zinc-300"><span className="text-zinc-500">Justification:</span> {selection.justification}</p>
        </div>
      ) : null}
    </section>
  )
}
