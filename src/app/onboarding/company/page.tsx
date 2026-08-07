import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createCompanyAction } from '@/modules/identity/company-onboarding/actions'
import { getOnboardingError } from '@/modules/identity/company-onboarding/feedback'
import { getActiveMembership } from '@/modules/identity/company-onboarding/queries'
import {
  inputClassName,
  primaryButtonClassName,
} from '@/modules/identity/auth/auth-panel'

export const dynamic = 'force-dynamic'

type CompanyOnboardingPageProps = {
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function CompanyOnboardingPage({
  searchParams,
}: CompanyOnboardingPageProps) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/login?error=session_required')
  }

  const membership = await getActiveMembership()

  if (membership) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const feedback = getOnboardingError(params.error)

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl shadow-black/20">
        <div className="border-b border-zinc-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Atlas · Onboarding
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Criar empresa
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Crie a empresa inicial para aceder ao espaço de trabalho do Atlas.
          </p>
        </div>

        {feedback ? (
          <div
            className="mt-6 rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {feedback}
          </div>
        ) : null}

        <form action={createCompanyAction} className="mt-8 space-y-5">
          <label className="block text-sm font-medium" htmlFor="company_name">
            Nome da empresa
            <input
              autoComplete="organization"
              className={inputClassName}
              id="company_name"
              maxLength={160}
              minLength={2}
              name="company_name"
              required
              type="text"
            />
          </label>

          <label
            className="block text-sm font-medium"
            htmlFor="company_tax_number"
          >
            NIF <span className="font-normal text-zinc-500">(opcional)</span>
            <input
              className={inputClassName}
              id="company_tax_number"
              maxLength={64}
              name="company_tax_number"
              type="text"
            />
          </label>

          <button className={primaryButtonClassName} type="submit">
            Criar empresa e continuar
          </button>
        </form>
      </section>
    </main>
  )
}
