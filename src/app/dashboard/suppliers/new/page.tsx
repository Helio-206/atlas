import Link from 'next/link'

import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { inputClass, labelClass } from '@/modules/procurement/presentation/components'
import { createSupplierAction } from '@/modules/procurement/presentation/sourcing-actions'
import { getSourcingError } from '@/modules/procurement/presentation/sourcing-feedback'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ error?: string | string[] }> }

export default async function NewSupplierPage({ searchParams }: Props) {
  const access = await requireProcurementAccess()
  if (!access.can('Procurement.SupplierManage')) {
    return <main className="min-h-screen bg-zinc-950 p-12 text-zinc-100">Sem permissão para gerir fornecedores.</main>
  }
  const query = await searchParams
  const error = getSourcingError(query.error)

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-3xl">
        <Link className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500" href="/dashboard/suppliers">Fornecedores</Link>
        <h1 className="mt-3 text-3xl font-semibold">Novo fornecedor</h1>
        {error ? <div className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">{error}</div> : null}
        <form action={createSupplierAction} className="mt-8 grid gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:grid-cols-2">
          <label className="md:col-span-2"><span className={labelClass}>Nome</span><input className={inputClass} name="name" required /></label>
          <label><span className={labelClass}>NIF</span><input className={inputClass} name="tax_number" /></label>
          <label><span className={labelClass}>Email</span><input className={inputClass} name="email" type="email" /></label>
          <label><span className={labelClass}>Telefone</span><input className={inputClass} name="phone" /></label>
          <label className="md:col-span-2"><span className={labelClass}>Morada</span><textarea className={inputClass} name="address" rows={3} /></label>
          <div className="md:col-span-2 flex justify-end"><button className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950" type="submit">Criar fornecedor</button></div>
        </form>
      </section>
    </main>
  )
}
