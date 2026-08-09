export function assertDemoResetAllowed(env, supabaseUrl) {
  const mode = env.ATLAS_ENV
  if (mode === 'production' || env.NODE_ENV === 'production' && mode !== 'demo') {
    throw new Error('demo_reset_production_forbidden')
  }
  const url = new URL(supabaseUrl)
  if (mode === 'local') {
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('demo_reset_local_requires_loopback')
    return
  }
  if (mode === 'demo') {
    const projectRef = env.ATLAS_DEMO_PROJECT_REF
    if (!projectRef || env.ATLAS_DEMO_CONFIRM_RESET !== 'RESET_DEMO') throw new Error('demo_reset_confirmation_required')
    if (url.hostname !== `${projectRef}.supabase.co`) throw new Error('demo_reset_project_mismatch')
    return
  }
  throw new Error('demo_reset_environment_required')
}
