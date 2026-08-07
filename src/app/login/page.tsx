import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { loginAction } from '@/modules/identity/auth/actions'
import {
  AuthPanel,
  inputClassName,
  linkClassName,
  primaryButtonClassName,
} from '@/modules/identity/auth/auth-panel'
import {
  getAuthError,
  getAuthMessage,
} from '@/modules/identity/auth/feedback'

export const dynamic = 'force-dynamic'

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[]
    message?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()

  if (!error && data?.claims) {
    redirect('/dashboard')
  }

  const params = await searchParams

  return (
    <AuthPanel
      title="Iniciar sessão"
      description="Aceda à área interna do Atlas com a sua conta."
      error={getAuthError(params.error)}
      message={getAuthMessage(params.message)}
      footer={
        <p>
          Ainda não tem conta?{' '}
          <Link className={linkClassName} href="/signup">
            Criar conta
          </Link>
        </p>
      }
    >
      <form action={loginAction} className="space-y-5">
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
            autoComplete="current-password"
            className={inputClassName}
            id="password"
            maxLength={128}
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>

        <div className="flex justify-end">
          <Link className={linkClassName} href="/forgot-password">
            Esqueceu a password?
          </Link>
        </div>

        <button className={primaryButtonClassName} type="submit">
          Entrar
        </button>
      </form>
    </AuthPanel>
  )
}
