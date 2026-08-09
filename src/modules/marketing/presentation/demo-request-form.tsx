'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import type { DemoRequestFormState } from '../contracts/demo-request'
import { submitDemoRequestAction } from './actions'

const initialState: DemoRequestFormState = {
  status: 'idle',
  message: '',
}

export function DemoRequestForm() {
  const [state, action] = useActionState(submitDemoRequestAction, initialState)

  if (state.status === 'success') {
    return (
      <div className="landing-form-success" role="status">
        <p className="landing-kicker">PEDIDO REGISTADO</p>
        <h3>Recebemos o seu pedido.</h3>
        <p>{state.message}</p>
      </div>
    )
  }

  return (
    <form action={action} className="landing-form" noValidate>
      <div aria-hidden className="landing-honeypot">
        <label htmlFor="website">Website</label>
        <input autoComplete="off" id="website" name="website" tabIndex={-1} />
      </div>
      <FormField error={state.fieldErrors?.name} label="Nome" name="name" />
      <FormField error={state.fieldErrors?.company} label="Empresa" name="company" />
      <FormField error={state.fieldErrors?.email} label="Email" name="email" type="email" />
      <FormField error={state.fieldErrors?.phone} label="Telefone" name="phone" type="tel" />
      <FormField error={state.fieldErrors?.role} label="Cargo" name="role" />
      <label className="landing-field landing-field-wide">
        <span>Mensagem <small>Opcional</small></span>
        <textarea aria-invalid={Boolean(state.fieldErrors?.message)} maxLength={2000} name="message" rows={4} />
        {state.fieldErrors?.message ? <small className="landing-field-error">{state.fieldErrors.message}</small> : null}
      </label>
      {state.status === 'error' ? <p className="landing-form-error" role="alert">{state.message}</p> : null}
      <div className="landing-form-actions landing-field-wide">
        <SubmitButton />
        <p>Os dados são usados apenas para responder ao seu pedido.</p>
      </div>
    </form>
  )
}

function FormField({
  error,
  label,
  name,
  type = 'text',
}: {
  error?: string
  label: string
  name: string
  type?: 'text' | 'email' | 'tel'
}) {
  return (
    <label className="landing-field">
      <span>{label}</span>
      <input aria-invalid={Boolean(error)} autoComplete={name === 'name' ? 'name' : name === 'company' ? 'organization' : name === 'role' ? 'organization-title' : name === 'phone' ? 'tel' : name} name={name} type={type} />
      {error ? <small className="landing-field-error">{error}</small> : null}
    </label>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button className="landing-button landing-button-primary" disabled={pending} type="submit">{pending ? 'A enviar…' : 'Solicitar demonstração'}</button>
}
