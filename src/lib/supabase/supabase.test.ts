import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createAdminSupabaseClient } from './admin'
import { createBrowserSupabaseClient } from './browser'
import { createServerSupabaseClient } from './server'

const originalEnvironment = {
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
}

function restoreEnvironmentVariable(
  name: string,
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

afterEach(() => {
  restoreEnvironmentVariable(
    'NEXT_PUBLIC_SUPABASE_URL',
    originalEnvironment.url,
  )
  restoreEnvironmentVariable(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    originalEnvironment.publishableKey,
  )
  restoreEnvironmentVariable(
    'SUPABASE_SERVICE_ROLE_KEY',
    originalEnvironment.serviceRoleKey,
  )
})

describe('Supabase environment validation', () => {
  it('fails when browser public URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key'

    expect(() => createBrowserSupabaseClient()).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL',
    )
  })

  it('fails when browser publishable key is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    expect(() => createBrowserSupabaseClient()).toThrow(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    )
  })

  it('fails when server public configuration is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    await expect(createServerSupabaseClient()).rejects.toThrow(
      'NEXT_PUBLIC_SUPABASE_URL',
    )
  })

  it('fails when admin service role is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => createAdminSupabaseClient()).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY',
    )
  })
})

describe('Supabase client boundaries', () => {
  it('keeps the browser client independent from the service role', () => {
    const browserSource = readFileSync(
      new URL('./browser.ts', import.meta.url),
      'utf8',
    )

    expect(browserSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(browserSource).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  })

  it('marks the admin client as server-only', () => {
    const adminSource = readFileSync(
      new URL('./admin.ts', import.meta.url),
      'utf8',
    )

    expect(adminSource).toMatch(/^import 'server-only'/)
    expect(adminSource).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(adminSource).toContain('persistSession: false')
    expect(adminSource).toContain('autoRefreshToken: false')
  })
})
