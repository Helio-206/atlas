import type { PurchaseRequestStatus } from '../domain/purchase-request'

const labels: Record<PurchaseRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submetida',
  technical_review: 'Revisão técnica',
  financial_review: 'Revisão financeira',
  executive_review: 'Revisão executiva',
  approved: 'Aprovada',
  returned: 'Devolvida',
  rejected: 'Rejeitada',
  cancelled: 'Cancelada',
}

export function PurchaseRequestStatusBadge({ status }: { status: PurchaseRequestStatus }) {
  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300">
      {labels[status]}
    </span>
  )
}

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function statusLabel(status: PurchaseRequestStatus) {
  return labels[status]
}

export const inputClass = 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500'
export const labelClass = 'mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500'
