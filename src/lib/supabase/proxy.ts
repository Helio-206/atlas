import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { shouldUseSecureCookies } from './cookie-security'

const AUTH_ENTRY_ROUTES = new Set(['/login', '/signup'])
const PROTECTED_PREFIXES = ['/dashboard']

function getProxyEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL',
    )
  }

  if (!supabasePublishableKey) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    )
  }

  return { supabasePublishableKey, supabaseUrl }
}

function copyResponseState(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie)
  })

  for (const headerName of ['cache-control', 'expires', 'pragma']) {
    const value = source.headers.get(headerName)
    if (value) {
      target.headers.set(headerName, value)
    }
  }

  return target
}

export async function updateSession(request: NextRequest) {
  const { supabasePublishableKey, supabaseUrl } = getProxyEnvironment()
  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            sameSite: options.sameSite ?? 'lax',
            secure: shouldUseSecureCookies(),
          })
        })

        Object.entries(cacheHeaders).forEach(([name, value]) => {
          response.headers.set(name, value)
        })
      },
    },
  })

  // Keep this immediately after client creation. It validates/refreshes the JWT
  // before routing decisions and prevents stale cookie state reaching RSCs.
  const { data, error } = await supabase.auth.getClaims()
  const isAuthenticated = !error && Boolean(data?.claims)
  const pathname = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  )

  if (!isAuthenticated && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('error', 'session_required')
    return copyResponseState(response, NextResponse.redirect(url))
  }

  if (isAuthenticated && AUTH_ENTRY_ROUTES.has(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return copyResponseState(response, NextResponse.redirect(url))
  }

  return response
}
