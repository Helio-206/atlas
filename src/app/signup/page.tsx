import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { signupAction } from '@/modules/identity/auth/actions'
import {
  AuthPanel,
  inputClassName,
  linkClassName,
  primaryButtonClassName,
} from '@/modules/identity/auth/auth-panel'
import { getAuthError } from '@/modules/identity/auth/feedback'

export const dynamic = 'force-dynamic'

type SignupPageProps = {
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()

  if (!error && data?.claims) {
    redirect('/dashboard')
  }

  const params = await searchParams

  return (
    <AuthPanel
      title="Criar conta"
      description="Crie a sua identidade de acesso ao Atlas."
      error={getAuthError(params.error)}
      footer={
        <p>
          Já tem conta?{' '}
          <Link className={linkClassName} href="/login">
            Iniciar sessão
          </Link>
        </p>
      }
    >
      <form action={signupAction} className="space-y-5">
        <label className="block text-sm font-medium" htmlFor="full_name">
          Nome completo
          <input
            autoComplete="name"
            className={inputClassName}
            id="full_name"
            maxLength={120}
            minLength={2}
            name="full_name"
            required
            type="text"
          />
        </label>

        <label className="block text-sm font-medium" htmlFor="email">
          Email
          <input
            autoComplete="email"
            className={inputClassName}
            id="email"
            maxLength={320}
            name="email"
            required
            type="email"
          />
        </label>

        <label className="block text-sm font-medium" htmlFor="password">
          Password
          <input
            autoComplete="new-password"
            className={inputClassName}
            id="password"
            maxLength={128}
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>

        <label
          className="block text-sm font-medium"
          htmlFor="confirm_password"
        >
          Confirmar password
          <input
            autoComplete="new-password"
            className={inputClassName}
            id="confirm_password"
            maxLength={128}
            minLength={8}
            name="confirm_password"
            required
            type="password"
          />
        </label>

        <button className={primaryButtonClassName} type="submit">
          Criar conta
        </button>
      </form>
    </AuthPanel>
  )
}
