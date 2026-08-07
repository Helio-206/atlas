'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from './schemas'

const RECOVERY_COOKIE = 'atlas-password-recovery'

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function redirectWithCode(
  pathname: string,
  type: 'error' | 'message',
  code: string,
): never {
  const [basePath, query = ''] = pathname.split('?')
  const searchParams = new URLSearchParams(query)
  searchParams.set(type, code)
  redirect(`${basePath}?${searchParams.toString()}`)
}

function getApplicationUrl() {
  const applicationUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!applicationUrl) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_APP_URL',
    )
  }

  return applicationUrl.replace(/\/+$/, '')
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: getFormValue(formData, 'email'),
    password: getFormValue(formData, 'password'),
  })

  if (!parsed.success) {
    redirectWithCode('/login', 'error', 'invalid_form')
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    redirectWithCode('/login', 'error', 'invalid_credentials')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    fullName: getFormValue(formData, 'full_name'),
    email: getFormValue(formData, 'email'),
    password: getFormValue(formData, 'password'),
    confirmPassword: getFormValue(formData, 'confirm_password'),
  })

  if (!parsed.success) {
    redirectWithCode('/signup', 'error', 'invalid_form')
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
      },
      emailRedirectTo: `${getApplicationUrl()}/auth/callback?next=/onboarding/company`,
    },
  })

  if (error) {
    redirectWithCode('/signup', 'error', 'signup_failed')
  }

  revalidatePath('/', 'layout')

  if (data.session) {
    redirect('/onboarding/company')
  }

  redirectWithCode('/login', 'message', 'check_email')
}

export async function forgotPasswordAction(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({
    email: getFormValue(formData, 'email'),
  })

  if (!parsed.success) {
    redirectWithCode('/forgot-password', 'error', 'invalid_form')
  }

  const callbackUrl = new URL('/auth/callback', getApplicationUrl())
  callbackUrl.searchParams.set('next', '/forgot-password?mode=reset')

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: callbackUrl.toString(),
    },
  )

  if (error) {
    redirectWithCode('/forgot-password', 'error', 'recovery_failed')
  }

  redirectWithCode('/forgot-password', 'message', 'recovery_sent')
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    password: getFormValue(formData, 'password'),
    confirmPassword: getFormValue(formData, 'confirm_password'),
  })

  if (!parsed.success) {
    redirectWithCode(
      '/forgot-password?mode=reset',
      'error',
      'invalid_form',
    )
  }

  const cookieStore = await cookies()
  const recoveryCookie = cookieStore.get(RECOVERY_COOKIE)

  if (recoveryCookie?.value !== '1') {
    redirectWithCode(
      '/forgot-password',
      'error',
      'recovery_session_required',
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  if (claimsError || !claimsData?.claims) {
    cookieStore.delete(RECOVERY_COOKIE)
    redirectWithCode(
      '/forgot-password',
      'error',
      'recovery_session_required',
    )
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    redirectWithCode(
      '/forgot-password?mode=reset',
      'error',
      'reset_failed',
    )
  }

  await supabase.auth.signOut()
  cookieStore.delete(RECOVERY_COOKIE)
  revalidatePath('/', 'layout')
  redirectWithCode('/login', 'message', 'password_updated')
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete(RECOVERY_COOKIE)

  revalidatePath('/', 'layout')
  redirect('/login')
}
