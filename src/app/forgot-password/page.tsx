import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  forgotPasswordAction,
  resetPasswordAction,
} from '@/modules/identity/auth/actions'
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

const RECOVERY_COOKIE = 'atlas-password-recovery'

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[]
    message?: string | string[]
    mode?: string | string[]
  }>
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode

  if (mode === 'reset') {
    const cookieStore = await cookies()
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.getClaims()

    if (
      error ||
      !data?.claims ||
      cookieStore.get(RECOVERY_COOKIE)?.value !== '1'
    ) {
      redirect('/forgot-password?error=recovery_session_required')
    }

    return (
      <AuthPanel
        title="Definir nova password"
        description="Escolha uma nova password para concluir a recuperação."
        error={getAuthError(params.error)}
      >
        <form action={resetPasswordAction} className="space-y-5">
          <label className="block text-sm font-medium" htmlFor="password">
            Nova password
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
            Confirmar nova password
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
            Alterar password
          </button>
        </form>
      </AuthPanel>
    )
  }

  return (
    <AuthPanel
      title="Recuperar password"
      description="Indique o email da conta. Não revelamos se esse endereço está registado."
      error={getAuthError(params.error)}
      message={getAuthMessage(params.message)}
      footer={
        <Link className={linkClassName} href="/login">
          Voltar ao login
        </Link>
      }
    >
      <form action={forgotPasswordAction} className="space-y-5">
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

        <button className={primaryButtonClassName} type="submit">
          Enviar instruções
        </button>
      </form>
    </AuthPanel>
  )
}
