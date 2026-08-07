import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

const RECOVERY_COOKIE = 'atlas-password-recovery'
const ALLOWED_DESTINATIONS = new Set([
  '/dashboard',
  '/forgot-password?mode=reset',
])

function getDestination(value: string | null) {
  return value && ALLOWED_DESTINATIONS.has(value) ? value : '/dashboard'
}

function redirectWithError(request: NextRequest, code: string) {
  const url = new URL('/login', request.url)
  url.searchParams.set('error', code)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null
  const destination = getDestination(request.nextUrl.searchParams.get('next'))

  if (!code && !(tokenHash && type)) {
    return redirectWithError(request, 'callback_missing')
  }

  const supabase = await createServerSupabaseClient()

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: type!,
      })

  if (error) {
    return redirectWithError(request, 'callback_failed')
  }

  const response = NextResponse.redirect(new URL(destination, request.url))

  if (type === 'recovery' || destination.startsWith('/forgot-password')) {
    response.cookies.set(RECOVERY_COOKIE, '1', {
      httpOnly: true,
      maxAge: 10 * 60,
      path: '/forgot-password',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  }

  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
