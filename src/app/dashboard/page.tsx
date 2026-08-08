import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logoutAction } from '@/modules/identity/auth/actions'
import { getActiveMembership } from '@/modules/identity/company-onboarding/queries'
import { ListProjects } from '@/modules/projects/application/use-cases'
import {
  ListPendingApprovals,
  ListPurchaseRequests,
} from '@/modules/procurement/application/use-cases'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/login?error=session_required')
  }

  const membership = await getActiveMembership()

  if (!membership) {
    redirect('/onboarding/company')
  }

  const email =
    typeof data.claims.email === 'string' ? data.claims.email : 'Utilizador'

  const [projects, requests, approvals] = await Promise.all([
    ListProjects.execute(),
    ListPurchaseRequests.execute(),
    ListPendingApprovals.execute().catch(() => []),
  ])

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-6xl">
        <header className="flex items-start justify-between gap-6 border-b border-zinc-800 pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Atlas
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-zinc-400">Sessão: {email}</p>
          </div>

          <form action={logoutAction}>
            <button
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium transition hover:border-zinc-500 hover:bg-zinc-900"
              type="submit"
            >
              Terminar sessão
            </button>
          </form>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Metric label="Projetos" value={String(projects.length)} />
          <Metric label="Solicitações" value={String(requests.length)} />
          <Metric
            label="Aprovações pendentes"
            value={String(approvals.length)}
          />
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Module
            href="/dashboard/projects"
            title="Projetos"
            text="Criar, consultar e gerir o ciclo de vida dos projetos da empresa."
          />
          <Module
            href="/dashboard/procurement"
            title="Procurement"
            text="Criar solicitações, gerir itens e acompanhar aprovações."
          />
          <Module
            href="/dashboard/approvals"
            title="Aprovações"
            text="Inbox contextual para revisões técnicas, financeiras e executivas."
          />
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Segurança
            </p>
            <h2 className="mt-3 text-xl font-semibold">Empresa ativa</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              A sessão e a membership ativa são validadas no servidor antes de
              aceder aos módulos internos.
            </p>
          </div>
        </div>

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Solicitações recentes</h2>
          <div className="mt-4 space-y-3">
            {requests.slice(0, 5).map((request) => (
              <Link
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm transition hover:border-zinc-700"
                href={`/dashboard/procurement/${request.id}`}
                key={request.id}
              >
                <span>
                  {request.requestNumber} · {request.projectName}
                </span>
                <span className="text-zinc-500">{request.status}</span>
              </Link>
            ))}
            {requests.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Ainda não existem solicitações.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function Module({
  href,
  title,
  text,
}: {
  href: string
  title: string
  text: string
}) {
  return (
    <Link
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-7 transition hover:border-zinc-700"
      href={href}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Módulo
      </p>
      <h2 className="mt-3 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </Link>
  )
}
