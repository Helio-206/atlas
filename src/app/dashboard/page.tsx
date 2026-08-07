import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logoutAction } from '@/modules/identity/auth/actions'
import { getActiveMembership } from '@/modules/identity/company-onboarding/queries'

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

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto max-w-5xl">
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

        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <h2 className="text-lg font-semibold">Área interna protegida</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Esta página só é renderizada quando a sessão e a membership ativa da
            empresa foram validadas no servidor.
          </p>
        </div>
      </section>
    </main>
  )
}
