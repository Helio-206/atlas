import Link from 'next/link'

import { ListSuppliers } from '@/modules/procurement/application/sourcing-use-cases'
import { SUPPLIER_STATUSES } from '@/modules/procurement/domain/sourcing'
import { requireProcurementAccess } from '@/modules/procurement/presentation/access'
import { inputClass, labelClass } from '@/modules/procurement/presentation/components'
import { getSourcingError, getSourcingNotice } from '@/modules/procurement/presentation/sourcing-feedback'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{
    status?: string | string[]
    search?: string | string[]
    error?: string | string[]
    notice?: string | string[]
  }>
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export default async function SuppliersPage({ searchParams }: Props) {
  const access = await requireProcurementAccess()
  if (!access.can('Procurement.SupplierView')) {
    return <main className="min-h-screen bg-zinc-950 p-12 text-zinc-100">Sem permissão para consultar fornecedores.</main>
  }

  const query = await searchParams
  const status = first(query.status)
  const search = first(query.search)
  const suppliers = await ListSuppliers({
    status: SUPPLIER_STATUSES.includes(status as never) ? status : null,
    search: search || null,
  })
  const error = getSourcingError(query.error)
  const notice = getSourcingNotice(query.notice)

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-zinc-800 pb-8">
          <div>
            <Link className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300" href="/dashboard">Dashboard</Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Fornecedores</h1>
            <p className="mt-2 text-sm text-zinc-400">Cadastro e estado dos fornecedores da empresa.</p>
          </div>
          {access.can('Procurement.SupplierManage') ? (
            <Link className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950" href="/dashboard/suppliers/new">Novo fornecedor</Link>
          ) : null}
        </header>

        {error ? <div className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">{error}</div> : null}
        {notice ? <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300" role="status">{notice}</div> : null}

        <form className="mt-8 grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-[1fr_220px_auto]" method="get">
          <label><span className={labelClass}>Pesquisa</span><input className={inputClass} defaultValue={search ?? ''} name="search" placeholder="Nome ou NIF" /></label>
          <label><span className={labelClass}>Estado</span><select className={inputClass} defaultValue={status ?? ''} name="status"><option value="">Todos</option>{SUPPLIER_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <button className="self-end rounded-lg border border-zinc-700 px-4 py-2.5 text-sm" type="submit">Filtrar</button>
        </form>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-500"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">NIF</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Estado</th></tr></thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="px-4 py-4 font-medium"><Link className="hover:underline" href={`/dashboard/suppliers/${supplier.id}`}>{supplier.name}</Link></td>
                  <td className="px-4 py-4 text-zinc-400">{supplier.taxNumber ?? '—'}</td>
                  <td className="px-4 py-4 text-zinc-400">{supplier.email ?? '—'}</td>
                  <td className="px-4 py-4 text-zinc-400">{supplier.phone ?? '—'}</td>
                  <td className="px-4 py-4"><span className="rounded-full border border-zinc-700 px-2 py-1 text-xs capitalize">{supplier.status}</span></td>
                </tr>
              ))}
              {suppliers.length === 0 ? <tr><td className="px-4 py-8 text-center text-zinc-500" colSpan={5}>Nenhum fornecedor encontrado.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
