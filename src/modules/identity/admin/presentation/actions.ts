'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { UpdateApprovalSettings } from '@/modules/procurement/application/use-cases'
import { logOperationalError } from '@/platform/observability/logger'

import { setCompanyMembershipStatusRepository } from '../infrastructure/admin-repository'

const membershipSchema = z.object({
  membershipId: z.string().uuid(),
  expectedStatus: z.enum(['active', 'suspended']),
  status: z.enum(['active', 'suspended']),
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
