'use client'

import { useMemo, useState } from 'react'

import { createQuotationAction } from './sourcing-actions'
import { inputClass, labelClass } from './components'

type SupplierOption = { id: string; name: string; status: string }
type RequestItemOption = {
  id: string
  description: string
  quantity: number
  unit: string
}

type Props = {
  purchaseRequestId: string
  suppliers: SupplierOption[]
  requestItems: RequestItemOption[]
}

type DraftItem = RequestItemOption & { unitPrice: string }

export function QuotationForm({ purchaseRequestId, suppliers, requestItems }: Props) {
  const [items, setItems] = useState<DraftItem[]>(
    requestItems.map((item) => ({ ...item, unitPrice: '0' })),
  )
  const [taxAmount, setTaxAmount] = useState('0')
  const [currency, setCurrency] = useState('AOA')

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * (Number(item.unitPrice) || 0), 0),
    [items],
  )
  const total = subtotal + (Number(taxAmount) || 0)
  const serializedItems = JSON.stringify(
    items.map((item) => ({
      purchaseRequestItemId: item.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: Number(item.unitPrice) || 0,
    })),
  )

  return (
    <form action={createQuotationAction} className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <input name="purchase_request_id" type="hidden" value={purchaseRequestId} />
      <input name="items_json" type="hidden" value={serializedItems} />
      <div className="grid gap-5 md:grid-cols-2">
        <label><span className={labelClass}>Fornecedor</span><select className={inputClass} name="supplier_id" required defaultValue=""><option disabled value="">Selecionar</option>{suppliers.filter((supplier) => supplier.status !== 'blocked').map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.status === 'inactive' ? ' · inactive' : ''}</option>)}</select></label>
        <label><span className={labelClass}>Número da cotação</span><input className={inputClass} name="quotation_number" /></label>
        <label><span className={labelClass}>Moeda</span><select className={inputClass} name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="AOA">AOA</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        <label><span className={labelClass}>Imposto</span><input className={inputClass} min="0" name="tax_amount" onChange={(event) => setTaxAmount(event.target.value)} step="0.01" type="number" value={taxAmount} /></label>
        <label><span className={labelClass}>Válida até</span><input className={inputClass} name="valid_until" type="date" /></label>
        <label><span className={labelClass}>Prazo de entrega (dias)</span><input className={inputClass} min="0" name="delivery_days" type="number" /></label>
        <label className="md:col-span-2"><span className={labelClass}>Condições de pagamento</span><input className={inputClass} name="payment_terms" /></label>
        <label className="md:col-span-2"><span className={labelClass}>Notas</span><textarea className={inputClass} name="notes" rows={2} /></label>
      </div>

      <div className="mt-7 flex items-center justify-between"><div><h3 className="font-semibold">Itens cotados</h3><p className="mt-1 text-xs text-zinc-500">Remova itens para registar uma cotação parcial.</p></div><span className="text-xs text-zinc-500">{items.length}/{requestItems.length} itens</span></div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div className="grid items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-[1fr_120px_120px_auto]" key={item.id}>
            <div><div className="text-sm font-medium">{item.description}</div><div className="mt-1 text-xs text-zinc-500">{item.quantity} {item.unit}</div></div>
            <label><span className={labelClass}>Qtd.</span><input className={inputClass} min="0.0001" onChange={(event) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, quantity: Number(event.target.value) } : candidate))} step="0.0001" type="number" value={item.quantity} /></label>
            <label><span className={labelClass}>Preço unit.</span><input className={inputClass} min="0" onChange={(event) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, unitPrice: event.target.value } : candidate))} step="0.01" type="number" value={item.unitPrice} /></label>
            <button className="rounded-lg border border-zinc-700 px-3 py-2.5 text-sm" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))} type="button">Remover</button>
          </div>
        ))}
        {items.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">Nenhum item incluído. Uma cotação vazia pode ser guardada como draft, mas não pode ser submetida.</p> : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 pt-5">
        <div className="text-sm text-zinc-400"><span>Subtotal visual: {subtotal.toLocaleString('pt-PT')} {currency}</span><span className="ml-5 font-semibold text-zinc-100">Total visual: {total.toLocaleString('pt-PT')} {currency}</span><p className="mt-1 text-xs text-zinc-600">O servidor recalcula os valores a partir das linhas.</p></div>
        <button className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950" type="submit">Registar cotação</button>
      </div>
    </form>
  )
}
