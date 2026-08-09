'use client'

import { useMemo, useState } from 'react'

import { Money } from '@/components/atlas/ui'

import { selectSupplierAction } from './sourcing-actions'

type QuotationOption = {
  id: string
  supplierName: string
  supplierStatus: string
  total: number
  currency: string
  version: number
}

export function SupplierSelectionPanel({
  purchaseRequestId,
  requestVersion,
  quotations,
}: {
  purchaseRequestId: string
  requestVersion: number
  quotations: QuotationOption[]
}) {
  const selectable = quotations.filter((quotation) => quotation.supplierStatus !== 'blocked')
  const [selectedId, setSelectedId] = useState('')
  const [justification, setJustification] = useState('')
  const selected = useMemo(
    () => selectable.find((quotation) => quotation.id === selectedId) ?? null,
    [selectable, selectedId],
  )
  const valid = Boolean(selected && justification.trim())

  return (
    <section className="border-t border-[var(--border)] pt-5">
      <h2 className="text-[16px] font-medium">Selecionar fornecedor</h2>
      <form action={selectSupplierAction} className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <input name="purchase_request_id" type="hidden" value={purchaseRequestId} />
        <input name="expected_request_version" type="hidden" value={requestVersion} />
        <input name="quotation_id" type="hidden" value={selected?.id ?? ''} />
        <input name="expected_quotation_version" type="hidden" value={selected?.version ?? ''} />

        <div className="grid gap-0 border-y border-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-[var(--border)]">
          {quotations.map((quotation) => {
            const blocked = quotation.supplierStatus === 'blocked'
            const active = selectedId === quotation.id
            return (
              <div className={`px-4 py-4 ${active ? 'bg-[var(--surface-subtle)]' : ''}`} key={quotation.id}>
                <p className="text-[12px] font-medium">{quotation.supplierName}</p>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]"><Money currency={quotation.currency} value={quotation.total} /></p>
                {blocked ? (
                  <p className="mt-3 text-[11px] text-[var(--danger)]">Fornecedor bloqueado</p>
                ) : (
                  <button
                    aria-pressed={active}
                    className="atlas-button mt-3 w-full"
                    onClick={() => setSelectedId(quotation.id)}
                    type="button"
                  >
                    {active ? 'Selecionado' : 'Selecionar'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div>
          <label>
            <span className="atlas-label">Justificação (obrigatória)</span>
            <textarea
              className="atlas-input min-h-24 resize-y"
              name="justification"
              onChange={(event) => setJustification(event.target.value)}
              placeholder="Explique o motivo da seleção do fornecedor."
              value={justification}
            />
          </label>
          <button className="atlas-button atlas-button-primary mt-3" disabled={!valid} type="submit">Confirmar seleção</button>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">A confirmação requer fornecedor e justificação.</p>
        </div>
      </form>
    </section>
  )
}
