'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { UpdateApprovalSettings } from '@/modules/procurement/application/use-cases'
import { logOperationalError } from '@/platform/observability/logger'

import { setCompanyMembershipStatusRepository, updateDemoRequestRepository } from '../infrastructure/admin-repository'

const membershipSchema = z.object({
  membershipId: z.string().uuid(),
  expectedStatus: z.enum(['active', 'suspended']),
  status: z.enum(['active', 'suspended']),
})
const demoRequestSchema = z.object({
  id: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  status: z.enum(['new', 'contacted', 'qualified', 'demo_scheduled', 'pilot_proposed', 'won', 'lost']),
  internalNotes: z.string().max(4000),
})

function value(formData: FormData, key: string) {
  const result = formData.get(key)
  return typeof result === 'string' ? result : ''
}

export async function setMembershipStatusAction(formData: FormData) {
  const parsed = membershipSchema.safeParse({
    membershipId: value(formData, 'membership_id'),
    expectedStatus: value(formData, 'expected_status'),
    status: value(formData, 'status'),
  })
  if (!parsed.success) redirect('/dashboard/users?error=invalid_form')
  try {
    await setCompanyMembershipStatusRepository(parsed.data)
  } catch (error) {
    logOperationalError({ operation: 'admin.membership_status', error })
    redirect('/dashboard/users?error=membership_update_failed')
  }
  revalidatePath('/dashboard/users')
  redirect('/dashboard/users?notice=membership_updated')
}

export async function updatePilotApprovalSettingsAction(formData: FormData) {
  const threshold = Number(value(formData, 'threshold'))
  const currency = value(formData, 'currency')
  if (!Number.isFinite(threshold) || threshold < 0 || !['AOA', 'USD', 'EUR'].includes(currency)) {
    redirect('/dashboard/users?error=invalid_settings')
  }
  try {
    await UpdateApprovalSettings.execute({ threshold, currency })
  } catch (error) {
    logOperationalError({ operation: 'admin.approval_settings', error })
    redirect('/dashboard/users?error=settings_update_failed')
  }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/users')
  redirect('/dashboard/users?notice=settings_updated')
}

export async function updateDemoRequestAction(formData: FormData) {
  const parsed = demoRequestSchema.safeParse({
    id: value(formData, 'demo_request_id'),
    expectedUpdatedAt: value(formData, 'expected_updated_at'),
    status: value(formData, 'status'),
    internalNotes: value(formData, 'internal_notes'),
  })
  if (!parsed.success) redirect('/dashboard/admin/demo-requests?error=invalid_form')

  try {
    await updateDemoRequestRepository(parsed.data)
  } catch (error) {
    logOperationalError({ operation: 'admin.demo_request_update', error })
    redirect('/dashboard/admin/demo-requests?error=update_failed')
  }

  revalidatePath('/dashboard/admin/demo-requests')
  redirect('/dashboard/admin/demo-requests?notice=updated')
}
