const ONBOARDING_ERRORS: Record<string, string> = {
  invalid_form: 'Verifique os dados da empresa e tente novamente.',
  company_creation_failed: 'Não foi possível criar a empresa. Tente novamente.',
  session_required: 'A sua sessão expirou. Inicie sessão novamente.',
}

export function getOnboardingError(value?: string | string[]) {
  const code = Array.isArray(value) ? value[0] : value
  return code ? ONBOARDING_ERRORS[code] ?? ONBOARDING_ERRORS.company_creation_failed : undefined
}
