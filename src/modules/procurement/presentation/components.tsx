import { StatusBadge } from '@/components/atlas/ui'

import type { PurchaseRequestStatus } from '../domain/purchase-request'

const labels: Record<PurchaseRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submetida',
  technical_review: 'Revisão técnica',
  financial_review: 'Revisão financeira',
  executive_review: 'Revisão executiva',
  approved: 'Aprovada',
  supplier_selected: 'Fornecedor selecionado',
  ordered: 'Encomendada',
  partially_received: 'Parcialmente recebida',
  received: 'Recebida',
  returned: 'Devolvida',
  rejected: 'Rejeitada',
  cancelled: 'Cancelada',
}

export function PurchaseRequestStatusBadge({ status }: { status: PurchaseRequestStatus }) {
  return <StatusBadge label={labels[status]} tone={statusTone(status)} />
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

export const inputClass = 'atlas-input'
export const labelClass = 'atlas-label'

function statusTone(status: PurchaseRequestStatus) {
  if (['approved', 'received', 'supplier_selected'].includes(status)) return 'success' as const
  if (['rejected', 'cancelled'].includes(status)) return 'danger' as const
  if (['financial_review', 'executive_review', 'partially_received'].includes(status)) return 'warning' as const
  if (['technical_review', 'submitted', 'ordered'].includes(status)) return 'info' as const
  return 'neutral' as const
}
