import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  GetPurchaseRequest,
  ListPurchaseRequestItems,
} from '@/modules/procurement/application/use-cases'
import {
  GetQuotationComparison,
  GetSupplierSelection,
  ListSuppliers,
} from '@/modules/procurement/application/sourcing-use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { formatMoney } from '@/modules/procurement/presentation/components'
import { QuotationForm } from '@/modules/procurement/presentation/quotation-form'
import {
  selectSupplierAction,
  submitQuotationAction,
} from '@/modules/procurement/presentation/sourcing-actions'
import { getSourcingError, getSourcingNotice } from '@/modules/procurement/presentation/sourcing-feedback'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>
}

function coverageLabel(percent: number) {
  return percent >= 100 ? 'Full quotation' : `Partial quotation · ${percent.toFixed(0)}%`
}

export default async function QuotationsPage({ params, searchParams }: Props) {
  const access = await requireProcurementAccess()
  if (!access.can('Procurement.QuotationView')) {
    return <main className="min-h-screen bg-zinc-950 p-12 text-zinc-100">Sem permissão para consultar cotações.</main>
  }

  const { id } = await params
  const [request, items, comparison, selection, suppliers, query] = await Promise.all([
    GetPurchaseRequest.execute(id),
    ListPurchaseRequestItems.execute(id),
    GetQuotationComparison(id),
    GetSupplierSelection(id),
    access.can('Procurement.SupplierView') ? ListSuppliers() : Promise.resolve([]),
    searchParams,
  ])
  if (!request) notFound()

  const error = getSourcingError(query.error)
  const notice = getSourcingNotice(query.notice)
  const canManageQuotation = access.can('Procurement.QuotationManage') && request.status === 'approved'
  const canSelect = access.can('Procurement.SupplierSelect') && request.status === 'approved' && !selection

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-zinc-800 pb-8">
          <div>
            <Link className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500" href={`/dashboard/procurement/${request.id}`}>{request.requestNumber}</Link>
            <h1 className="mt-3 text-3xl font-semibold">Comparação de cotações</h1>
            <p className="mt-2 text-sm text-zinc-400">Compare preço, prazo e cobertura. A decisão final continua humana.</p>
          </div>
          <Link className="rounded-lg border border-zinc-700 px-4 py-2 text-sm" href="/dashboard/suppliers">Fornecedores</Link>
        </header>

        {error ? <div className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">{error}</div> : null}
        {notice ? <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300" role="status">{notice}</div> : null}
        {comparison.highlights.currencyWarning ? <div className="mt-6 rounded-lg border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-200" role="note">{comparison.highlights.currencyWarning}</div> : null}

        {selection ? (
          <section className="mt-8 rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Selected Supplier</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3"><div><p className="text-xs text-zinc-500">Supplier</p><p className="mt-1 font-semibold">{selection.supplierName}</p></div><div><p className="text-xs text-zinc-500">Quotation</p><p className="mt-1">{selection.quotationNumber ?? 'Sem número'} · {formatMoney(selection.total, selection.currency)}</p></div><div><p className="text-xs text-zinc-500">Selected By / Date</p><p className="mt-1">{selection.selectedByName ?? selection.selectedBy} · {new Date(selection.selectedAt).toLocaleString('pt-PT')}</p></div></div>
            <p className="mt-4 text-sm text-zinc-300"><span className="text-zinc-500">Justification:</span> {selection.justification}</p>
          </section>
        ) : null}

        <section className="mt-8 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="min-w-[1050px] w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-500"><tr><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Currency</th><th className="px-4 py-3">Delivery Days</th><th className="px-4 py-3">Valid Until</th><th className="px-4 py-3">Payment Terms</th><th className="px-4 py-3">Coverage</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-zinc-800">
              {comparison.quotations.map((quotation) => {
                const coverage = quotation.coveragePercent ?? 0
                const tags = [
                  comparison.highlights.lowestPriceId === quotation.id ? 'Lowest Price' : null,
                  comparison.highlights.fastestDeliveryId === quotation.id ? 'Fastest Delivery' : null,
                  comparison.highlights.bestCoverageId === quotation.id ? 'Best Coverage' : null,
                ].filter(Boolean)
                return (
                  <tr key={quotation.id} className="align-top">
                    <td className="px-4 py-4"><div className="font-medium">{quotation.supplierName}</div><div className="mt-1 text-xs capitalize text-zinc-500">{quotation.supplierStatus}</div>{tags.length ? <div className="mt-2 flex flex-wrap gap-1">{tags.map((tag) => <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300" key={tag}>{tag}</span>)}</div> : null}</td>
                    <td className="px-4 py-4 font-semibold">{formatMoney(quotation.total, quotation.currency)}</td>
                    <td className="px-4 py-4">{quotation.currency}</td>
                    <td className="px-4 py-4">{quotation.deliveryDays ?? '—'}</td>
                    <td className="px-4 py-4">{quotation.validUntil ?? '—'}</td>
                    <td className="max-w-48 px-4 py-4 text-zinc-400">{quotation.paymentTerms ?? '—'}</td>
                    <td className="px-4 py-4"><span className={coverage < 100 ? 'text-amber-300' : 'text-zinc-300'}>{coverageLabel(coverage)}</span></td>
                    <td className="px-4 py-4 capitalize">{quotation.status}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-3">
                        {canManageQuotation && quotation.status === 'draft' ? <form action={submitQuotationAction}><input name="purchase_request_id" type="hidden" value={request.id} /><input name="quotation_id" type="hidden" value={quotation.id} /><input name="expected_version" type="hidden" value={quotation.version} /><button className="rounded-lg border border-zinc-700 px-3 py-2 text-xs" type="submit">Submit quotation</button></form> : null}
                        {canSelect && quotation.status === 'submitted' && quotation.supplierStatus !== 'blocked' ? <form action={selectSupplierAction} className="min-w-56 space-y-2"><input name="purchase_request_id" type="hidden" value={request.id} /><input name="quotation_id" type="hidden" value={quotation.id} /><input name="expected_request_version" type="hidden" value={request.version} /><input name="expected_quotation_version" type="hidden" value={quotation.version} /><textarea className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs" name="justification" placeholder="Justificação da seleção" required rows={2} /><button className="w-full rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-950" type="submit">Select supplier</button></form> : null}
                        {canSelect && quotation.supplierStatus === 'blocked' ? <span className="text-xs text-red-300">Blocked supplier cannot be selected.</span> : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {comparison.quotations.length === 0 ? <tr><td className="px-4 py-8 text-center text-zinc-500" colSpan={9}>Ainda não existem cotações.</td></tr> : null}
            </tbody>
          </table>
        </section>

        {canManageQuotation ? <QuotationForm purchaseRequestId={request.id} requestItems={items.map((item) => ({ id: item.id, description: item.description, quantity: item.quantity, unit: item.unit }))} suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, status: supplier.status }))} /> : null}
      </section>
    </main>
  )
}
