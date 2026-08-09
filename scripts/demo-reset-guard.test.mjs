import { describe, expect, it } from 'vitest'

import { assertDemoResetAllowed } from './demo-reset-guard.mjs'

describe('demo reset guard', () => {
  it('allows local reset only on loopback', () => {
    expect(() => assertDemoResetAllowed({ ATLAS_ENV: 'local', NODE_ENV: 'test' }, 'http://127.0.0.1:54321')).not.toThrow()
    expect(() => assertDemoResetAllowed({ ATLAS_ENV: 'local', NODE_ENV: 'test' }, 'https://example.supabase.co')).toThrow('demo_reset_local_requires_loopback')
  })

  it('rejects production explicitly', () => {
    expect(() => assertDemoResetAllowed({ ATLAS_ENV: 'production', NODE_ENV: 'production' }, 'https://prod.supabase.co')).toThrow('demo_reset_production_forbidden')
  })

  it('requires an explicit demo confirmation and matching project ref', () => {
    const env = { ATLAS_ENV: 'demo', NODE_ENV: 'production', ATLAS_DEMO_PROJECT_REF: 'demo123', ATLAS_DEMO_CONFIRM_RESET: 'RESET_DEMO' }
    expect(() => assertDemoResetAllowed(env, 'https://demo123.supabase.co')).not.toThrow()
    expect(() => assertDemoResetAllowed(env, 'https://other.supabase.co')).toThrow('demo_reset_project_mismatch')
    expect(() => assertDemoResetAllowed({ ...env, ATLAS_DEMO_CONFIRM_RESET: '' }, 'https://demo123.supabase.co')).toThrow('demo_reset_confirmation_required')
  })

  it('rejects missing environment classification', () => {
    expect(() => assertDemoResetAllowed({ NODE_ENV: 'test' }, 'http://127.0.0.1:54321')).toThrow('demo_reset_environment_required')
  })
})
