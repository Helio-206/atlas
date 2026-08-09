'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

import { DataTable, InlineError, PageHeader, SectionHeader, StatusBadge } from '@/components/atlas/ui'

import { recordGoodsReceiptAction } from './fulfillment-actions'

type ReceiptItem = {
  id: string
  description: string
  quantity: number
  quantityReceived: number
  remainingQuantity: number
  unit: string
}

export function GoodsReceiptForm({
  order,
  items,
  receivedBy,
  receiptDate,
  previousReceiptCount,
}: {
  order: {
    id: string
    orderNumber: string
    supplierName: string
    projectName: string
    total: number
    currency: string
    issuedAt: string
    status: string
    version: number
  }
  items: ReceiptItem[]
  receivedBy: string
  receiptDate: string
  previousReceiptCount: number
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.id, '0'])),
  )

  const errors = useMemo(() => Object.fromEntries(items.map((item) => {
    const raw = values[item.id] ?? '0'
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) return [item.id, 'Introduza uma quantidade válida.']
    if (value > item.remainingQuantity) return [item.id, `A quantidade não pode exceder ${item.remainingQuantity} ${item.unit}.`]
    return [item.id, '']
  })), [items, values])
  const selectedItems = items.filter((item) => Number(values[item.id] ?? 0) > 0 && !errors[item.id])
  const valid = selectedItems.length > 0 && Object.values(errors).every((error) => !error)

  return (
    <>
      <PageHeader
        actions={<><Link className="atlas-button" href={`/dashboard/purchase-orders/${order.id}`}>Cancelar</Link><button className="atlas-button atlas-button-primary" disabled={!valid} form="goods-receipt-form" type="submit">Registar receção</button></>}
        description={<><span className="font-medium text-[var(--text-primary)]">{order.orderNumber}</span><span className="mt-1 block">{order.supplierName}</span><span className="mt-1 block">Projeto: {order.projectName}</span></>}
        title="Registar receção"
      />

      <section aria-label="Contexto da ordem" className="mt-4 grid grid-cols-2 border-y border-[var(--border)] md:grid-cols-4">
        <Context label="Valor da ordem" value={new Intl.NumberFormat('pt-PT', { style: 'currency', currency: order.currency }).format(order.total)} />
        <Context label="Emitida em" value={new Date(order.issuedAt).toLocaleDateString('pt-PT')} />
        <Context label="Estado" value={<StatusBadge label={order.status === 'issued' ? 'Emitida' : 'Parcialmente recebida'} tone="warning" />} />
        <Context label="Receções anteriores" value={previousReceiptCount} />
      </section>

      <form
        action={recordGoodsReceiptAction}
        id="goods-receipt-form"
        onSubmit={(event) => { if (!valid) event.preventDefault() }}
      >
        <input name="purchase_order_id" type="hidden" value={order.id} />
        <input name="expected_version" type="hidden" value={order.version} />

        <section className="mt-5">
          <SectionHeader title="Informação da receção" />
          <div className="mt-3 grid gap-4 md:grid-cols-[0.8fr_1fr_1.8fr]">
            <label><span className="atlas-label">Data da receção</span><input className="atlas-input" defaultValue={receiptDate} type="date" /></label>
            <label><span className="atlas-label">Recebido por</span><input className="atlas-input" readOnly value={receivedBy} /></label>
            <label><span className="atlas-label">Notas (opcional)</span><textarea aria-label="Notas" className="atlas-input min-h-[38px] resize-y" maxLength={2000} name="notes" rows={1} /></label>
          </div>
        </section>

        <section className="mt-5">
          <SectionHeader title="Itens a receber" />
          <div className="mt-3 border-y border-[var(--border)]">
            <DataTable minWidth={900}>
              <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]"><tr><th className="px-2 py-3 font-medium">Item</th><th className="px-3 py-3 text-right font-medium">Encomendado</th><th className="px-3 py-3 text-right font-medium">Já recebido</th><th className="px-3 py-3 text-right font-medium">Pendente</th><th className="px-3 py-3 font-medium">Receber agora</th><th className="px-2 py-3 font-medium"><span className="sr-only">Ação</span></th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {items.map((item) => {
                  const complete = item.remainingQuantity <= 0
                  return (
                    <tr key={item.id}>
                      <td className="px-2 py-3 font-medium">{item.description}{complete ? <span className="mt-0.5 block text-[10px] font-normal text-[var(--success)]">Concluído</span> : null}</td>
                      <td className="atlas-tabular px-3 py-3 text-right">{item.quantity} {item.unit}</td>
                      <td className="atlas-tabular px-3 py-3 text-right">{item.quantityReceived} {item.unit}</td>
                      <td className="atlas-tabular px-3 py-3 text-right font-medium">{item.remainingQuantity} {item.unit}</td>
                      <td className="w-52 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            aria-invalid={Boolean(errors[item.id])}
                            aria-label={`Receber ${item.description}`}
                            className="atlas-input atlas-tabular"
                            disabled={complete}
                            max={item.remainingQuantity}
                            min="0"
                            name={`receive_${item.id}`}
                            onChange={(event) => setValues((current) => ({ ...current, [item.id]: event.target.value }))}
                            step="0.0001"
                            type="number"
                            value={values[item.id] ?? '0'}
                          />
                          <span className="text-[11px] text-[var(--text-muted)]">{item.unit}</span>
                        </div>
                        {errors[item.id] ? <InlineError>{errors[item.id]}</InlineError> : null}
                      </td>
                      <td className="px-2 py-3 text-right">{!complete ? <button className="whitespace-nowrap text-[11px] text-[var(--info)] hover:underline" onClick={() => setValues((current) => ({ ...current, [item.id]: String(item.remainingQuantity) }))} type="button">Receber tudo</button> : null}</td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          </div>
        </section>

        <section className="mt-5 grid gap-6 border-y border-[var(--border)] py-5 md:grid-cols-2 md:divide-x md:divide-[var(--border)]">
          <div className="md:pr-6">
            <SectionHeader title="Nesta receção" />
            <div className="mt-3 divide-y divide-[var(--border)]">
              {selectedItems.map((item) => <div className="flex justify-between gap-4 py-2 text-[12px]" key={item.id}><span>{item.description}</span><span className="atlas-tabular">{values[item.id]} {item.unit}</span></div>)}
              {selectedItems.length === 0 ? <p className="py-3 text-[12px] text-[var(--text-muted)]">Nenhuma quantidade indicada.</p> : <p className="py-2 text-[12px] font-medium">{selectedItems.length} item(ns)</p>}
            </div>
          </div>
          <div className="md:pl-6">
            <SectionHeader title="Após esta receção" />
            <div className="mt-3 divide-y divide-[var(--border)]">{items.map((item) => <div className="flex justify-between gap-4 py-2 text-[12px]" key={item.id}><span>{item.description}</span><span className="atlas-tabular">{item.quantityReceived + (Number(values[item.id]) || 0)} / {item.quantity} {item.unit}</span></div>)}</div>
          </div>
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[11px] text-[var(--text-muted)]">A receção será registada para {order.orderNumber}.</p>
          <div className="flex gap-2"><Link className="atlas-button" href={`/dashboard/purchase-orders/${order.id}`}>Cancelar</Link><button className="atlas-button atlas-button-primary" disabled={!valid} type="submit">Registar receção</button></div>
        </div>
      </form>
    </>
  )
}

function Context({ label, value }: { label: string; value: ReactNode }) {
  return <div className="border-r border-[var(--border)] px-5 py-4 last:border-r-0"><p className="text-[10px] text-[var(--text-muted)]">{label}</p><div className="mt-1 text-[13px] font-medium">{value}</div></div>
}
