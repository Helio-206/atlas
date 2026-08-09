'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import {
  demoRequestSchema,
  type DemoRequestFormState,
  type DemoRequestInput,
} from '../contracts/demo-request'

function formValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function fieldErrors(error: ReturnType<typeof demoRequestSchema.safeParse>) {
  if (error.success) return undefined
  const flattened = error.error.flatten().fieldErrors
  return Object.fromEntries(
    Object.entries(flattened).flatMap(([key, messages]) => {
      const first = messages?.[0]
      return first ? [[key, first]] : []
    }),
  ) as Partial<Record<keyof DemoRequestInput, string>>
}

export async function submitDemoRequestAction(
  _previousState: DemoRequestFormState,
  formData: FormData,
): Promise<DemoRequestFormState> {
  if (formValue(formData, 'website').trim()) {
    return { status: 'success', message: 'Pedido recebido.' }
  }

  const parsed = demoRequestSchema.safeParse({
    name: formValue(formData, 'name'),
    company: formValue(formData, 'company'),
    email: formValue(formData, 'email'),
    phone: formValue(formData, 'phone'),
    role: formValue(formData, 'role'),
    message: formValue(formData, 'message'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Reveja os campos assinalados.',
      fieldErrors: fieldErrors(parsed),
    }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('submit_demo_request', {
    p_name: parsed.data.name,
    p_company: parsed.data.company,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_role: parsed.data.role,
    p_message: parsed.data.message || null,
  })

  if (error) {
    const limited = error.message.includes('demo_request_rate_limited')
    return {
      status: 'error',
      message: limited
        ? 'Já recebemos pedidos recentes deste contacto. Tente novamente mais tarde.'
        : 'Não foi possível enviar o pedido. Tente novamente.',
    }
  }

  return {
    status: 'success',
    message: 'Pedido recebido. A nossa equipa entrará em contacto consigo.',
  }
}
