'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import { companyOnboardingSchema } from './schemas'

const companyIdSchema = z.string().uuid()

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

export async function createCompanyAction(formData: FormData) {
  const parsed = companyOnboardingSchema.safeParse({
    companyName: getFormValue(formData, 'company_name'),
    companyTaxNumber: getFormValue(formData, 'company_tax_number'),
  })

  if (!parsed.success) {
    redirect('/onboarding/company?error=invalid_form')
  }

  const supabase = await createServerSupabaseClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()

  if (claimsError || !claimsData?.claims) {
    redirect('/login?error=session_required')
  }

  const { data, error } = await supabase.schema('identity').rpc('create_company', {
    company_name: parsed.data.companyName,
    company_tax_number: parsed.data.companyTaxNumber,
  })

  if (error) {
    if (error.message.includes('active_membership_exists')) {
      redirect('/dashboard')
    }

    if (
      error.code === '42501' ||
      error.message.includes('authentication_required')
    ) {
      redirect('/login?error=session_required')
    }

    redirect('/onboarding/company?error=company_creation_failed')
  }

  if (!companyIdSchema.safeParse(data).success) {
    redirect('/onboarding/company?error=company_creation_failed')
  }

  revalidatePath('/', 'layout')
  revalidatePath('/dashboard')
  redirect('/dashboard')
}
