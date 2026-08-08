import Link from 'next/link'
import { notFound } from 'next/navigation'

import { GetSupplier } from '@/modules/procurement/application/sourcing-use-cases'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { inputClass, labelClass } from '@/modules/procurement/presentation/components'
import {
  activateSupplierAction,
  blockSupplierAction,
  deactivateSupplierAction,
  updateSupplierAction,
} from '@/modules/procurement/presentation/sourcing-actions'
import { getSourcingError, getSourcingNotice } from '@/modules/procurement/presentation/sourcing-feedback'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>
}

export default async function SupplierDetailPage({ params, searchParams }: Props) {
  const access = await requireProcurementAccess()
  if (!access.can('Procurement.SupplierView')) {
    return <main className="min-h-screen bg-zinc-950 p-12 text-zinc-100">Sem permissão para consultar fornecedores.</main>
  }
  const { id } = await params
  const [supplier, query] = await Promise.all([GetSupplier(id), searchParams])
  if (!supplier) notFound()
  const error = getSourcingError(query.error)
  const notice = getSourcingNotice(query.notice)
  const canManage = access.can('Procurement.SupplierManage')

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-zinc-800 pb-8">
          <div><Link className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500" href="/dashboard/suppliers">Fornecedores</Link><h1 className="mt-3 text-3xl font-semibold">{supplier.name}</h1><p className="mt-2 text-sm text-zinc-400">Estado: <span className="capitalize text-zinc-200">{supplier.status}</span> · versão {supplier.version}</p></div>
        </header>
        {error ? <div className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">{error}</div> : null}
        {notice ? <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300" role="status">{notice}</div> : null}

        <form action={updateSupplierAction} className="mt-8 grid gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:grid-cols-2">
          <input name="supplier_id" type="hidden" value={supplier.id} /><input name="expected_version" type="hidden" value={supplier.version} />
          <label className="md:col-span-2"><span className={labelClass}>Nome</span><input className={inputClass} defaultValue={supplier.name} disabled={!canManage} name="name" required /></label>
          <label><span className={labelClass}>NIF</span><input className={inputClass} defaultValue={supplier.taxNumber ?? ''} disabled={!canManage} name="tax_number" /></label>
          <label><span className={labelClass}>Email</span><input className={inputClass} defaultValue={supplier.email ?? ''} disabled={!canManage} name="email" type="email" /></label>
          <label><span className={labelClass}>Telefone</span><input className={inputClass} defaultValue={supplier.phone ?? ''} disabled={!canManage} name="phone" /></label>
          <label className="md:col-span-2"><span className={labelClass}>Morada</span><textarea className={inputClass} defaultValue={supplier.address ?? ''} disabled={!canManage} name="address" rows={3} /></label>
          {canManage ? <div className="md:col-span-2 flex justify-end"><button className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950" type="submit">Guardar alterações</button></div> : null}
        </form>

        {canManage ? (
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Estado do fornecedor</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {supplier.status !== 'active' ? <form action={activateSupplierAction}><input name="supplier_id" type="hidden" value={supplier.id} /><input name="expected_version" type="hidden" value={supplier.version} /><button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm" type="submit">Ativar</button></form> : null}
              {supplier.status !== 'inactive' ? <form action={deactivateSupplierAction}><input name="supplier_id" type="hidden" value={supplier.id} /><input name="expected_version" type="hidden" value={supplier.version} /><button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm" type="submit">Desativar</button></form> : null}
              {supplier.status !== 'blocked' ? <form action={blockSupplierAction}><input name="supplier_id" type="hidden" value={supplier.id} /><input name="expected_version" type="hidden" value={supplier.version} /><button className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300" type="submit">Bloquear</button></form> : null}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}
