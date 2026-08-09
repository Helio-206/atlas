import 'server-only'

import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'

const memberSchema = z.object({
  membership_id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string().nullable(),
  email: z.string().email(),
  role: z.string(),
  status: z.string(),
  created_at: z.string(),
})
const auditSchema = z.object({
  id: z.string().uuid(), action: z.string(), module: z.string(), resource_type: z.string(),
  resource_id: z.string().uuid().nullable(), user_id: z.string().uuid().nullable(), user_name: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()), created_at: z.string(),
})
const demoRequestSchema = z.object({
  id: z.string().uuid(), name: z.string(), company: z.string(), role: z.string(),
  email: z.string().email(), phone: z.string(), message: z.string().nullable(),
  status: z.enum(['new', 'contacted', 'qualified', 'demo_scheduled', 'pilot_proposed', 'won', 'lost']),
  internal_notes: z.string().nullable(), pilot_active: z.boolean(), version: z.number().int().positive(), created_at: z.string(), updated_at: z.string(),
})
const demoRequestMetricsSchema = z.object({
  new_leads: z.number().int().nonnegative(), demos_scheduled: z.number().int().nonnegative(),
  pilots_proposed: z.number().int().nonnegative(), pilots_active: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(), lost: z.number().int().nonnegative(),
})

function assertResult(error: { code?: string; message?: string } | null) {
  if (error) throw new Error(`admin_repository_error:${error.code ?? 'unknown'}`)
}

export async function listCompanyMembersRepository() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_company_members')
  assertResult(error)
  return z.array(memberSchema).parse(data ?? []).map((row) => ({
    membershipId: row.membership_id, userId: row.user_id, fullName: row.full_name, email: row.email,
    role: row.role, status: row.status, createdAt: row.created_at,
  }))
}

export async function setCompanyMembershipStatusRepository(input: { membershipId: string; expectedStatus: string; status: string }) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('set_company_membership_status', {
    membership_id: input.membershipId, expected_status: input.expectedStatus, status: input.status,
  })
  assertResult(error)
}

export async function listCompanyAuditRepository(maxItems = 100) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_company_audit', { max_items: maxItems })
  assertResult(error)
  return z.array(auditSchema).parse(data ?? []).map((row) => ({
    id: row.id, action: row.action, module: row.module, resourceType: row.resource_type,
    resourceId: row.resource_id, userId: row.user_id, userName: row.user_name, metadata: row.metadata, createdAt: row.created_at,
  }))
}

export async function listDemoRequestsRepository(maxItems = 100) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_demo_requests', { p_limit: maxItems })
  assertResult(error)
  return z.array(demoRequestSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    company: row.company,
    role: row.role,
    email: row.email,
    phone: row.phone,
    message: row.message,
    status: row.status,
    internalNotes: row.internal_notes,
    pilotActive: row.pilot_active,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function updateDemoRequestRepository(input: {
  id: string
  expectedVersion: number
  status: string
  internalNotes: string
  pilotActive: boolean
}) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('update_demo_request', {
    p_id: input.id,
    p_expected_version: input.expectedVersion,
    p_status: input.status,
    p_internal_notes: input.internalNotes || null,
    p_pilot_active: input.pilotActive,
  })
  assertResult(error)
  return z.number().int().positive().parse(data)
}

export async function getDemoRequestMetricsRepository() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_demo_request_metrics')
  assertResult(error)
  const metrics = demoRequestMetricsSchema.parse(data?.[0])
  return {
    newLeads: metrics.new_leads,
    demosScheduled: metrics.demos_scheduled,
    pilotsProposed: metrics.pilots_proposed,
    pilotsActive: metrics.pilots_active,
    won: metrics.won,
    lost: metrics.lost,
  }
}

export async function canManageDemoRequestsRepository() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('can_manage_demo_requests')
  assertResult(error)
  return data === true
}
