'use client'

import { useMemo, useState } from 'react'

type ProjectOption = {
  id: string
  code: string
  name: string
}

type ItemDraft = {
  key: string
  description: string
  quantity: string
  unit: string
  estimatedUnitPrice: string
}

type Props = {
  projects: ProjectOption[]
  action: (formData: FormData) => void | Promise<void>
}

const emptyItem = (key: string): ItemDraft => ({
  key,
  description: '',
  quantity: '1',
  unit: 'un',
  estimatedUnitPrice: '0',
})

export function PurchaseRequestCreateForm({ projects, action }: Props) {
  const [items, setItems] = useState<ItemDraft[]>([emptyItem('item-1')])

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const quantity = Number(item.quantity)
        const price = Number(item.estimatedUnitPrice)
        return sum + (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(price) ? price : 0)
      }, 0),
    [items],
  )

  function updateItem(key: string, field: keyof Omit<ItemDraft, 'key'>, value: string) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    )
  }

  function addItem() {
    setItems((current) => [...current, emptyItem(`item-${Date.now()}-${current.length}`)])
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key))
  }

  const serializedItems = JSON.stringify(
    items.map(({ description, quantity, unit, estimatedUnitPrice }) => ({
      description,
      quantity,
      unit,
      estimatedUnitPrice,
    })),
  )

  return (
    <form action={action} className="space-y-7">
      <input name="items_json" type="hidden" value={serializedItems} />

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Projeto">
          <select className={controlClass} name="project_id" required defaultValue="">
            <option disabled value="">Selecionar projeto ativo</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Prioridade">
          <select className={controlClass} name="priority" defaultValue="normal">
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </Field>

        <Field label="Data necessária">
          <input className={controlClass} name="required_date" type="date" required />
        </Field>

        <Field label="Moeda">
          <select className={controlClass} name="currency" defaultValue="AOA">
            <option value="AOA">AOA</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </Field>
      </div>

      <Field label="Finalidade">
        <textarea className={`${controlClass} min-h-28`} name="purpose" required maxLength={2000} />
      </Field>

      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-medium tracking-[-0.01em]">Itens</h2>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">O servidor recalcula o total a partir dos itens.</p>
          </div>
          <button className="atlas-button" type="button" onClick={addItem}>
            Adicionar item
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {items.map((item, index) => (
            <div className="atlas-paper-panel p-4" data-atlas-motion="paper-row" key={item.key}>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <label className="lg:col-span-2">
                  <span className={labelClass}>Descrição item {index + 1}</span>
                  <input aria-label={`Descrição item ${index + 1}`} className={controlClass} value={item.description} onChange={(event) => updateItem(item.key, 'description', event.target.value)} />
                </label>
                <label>
                  <span className={labelClass}>Quantidade item {index + 1}</span>
                  <input aria-label={`Quantidade item ${index + 1}`} className={controlClass} min="0.0001" step="0.0001" type="number" value={item.quantity} onChange={(event) => updateItem(item.key, 'quantity', event.target.value)} />
                </label>
                <label>
                  <span className={labelClass}>Unidade item {index + 1}</span>
                  <input aria-label={`Unidade item ${index + 1}`} className={controlClass} value={item.unit} onChange={(event) => updateItem(item.key, 'unit', event.target.value)} />
                </label>
                <label>
                  <span className={labelClass}>Preço estimado item {index + 1}</span>
                  <input aria-label={`Preço estimado item ${index + 1}`} className={controlClass} min="0" step="0.01" type="number" value={item.estimatedUnitPrice} onChange={(event) => updateItem(item.key, 'estimatedUnitPrice', event.target.value)} />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button className="text-[12px] text-[var(--danger)] hover:underline" type="button" onClick={() => removeItem(item.key)}>
                  Remover linha
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end text-right">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total calculado</p>
            <p className="atlas-money-paper mt-1 text-2xl font-semibold" data-testid="request-total">{total.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </section>

      <button className="atlas-button atlas-button-primary" type="submit">
        Criar solicitação
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

const labelClass = 'atlas-label'
const controlClass = 'atlas-input'
