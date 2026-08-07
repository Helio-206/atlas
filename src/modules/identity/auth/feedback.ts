const errorMessages: Record<string, string> = {
  callback_failed: 'Não foi possível concluir a autenticação. Tente novamente.',
  callback_missing: 'O link de autenticação está incompleto ou já não é válido.',
  invalid_credentials: 'Email ou password inválidos.',
  invalid_form: 'Verifique os dados introduzidos e tente novamente.',
  recovery_failed: 'Não foi possível enviar o pedido de recuperação. Tente novamente.',
  recovery_session_required: 'Abra novamente o link de recuperação enviado para o seu email.',
  reset_failed: 'Não foi possível alterar a password. Tente novamente.',
  session_required: 'Inicie sessão para aceder a esta área.',
  signup_failed: 'Não foi possível criar a conta. Verifique os dados e tente novamente.',
}

const successMessages: Record<string, string> = {
  check_email: 'Conta criada. Consulte o seu email para confirmar o acesso.',
  password_updated: 'Password alterada. Pode iniciar sessão com a nova password.',
  recovery_sent: 'Se a conta existir, receberá um email com instruções para recuperar a password.',
}

export function getAuthError(code: string | string[] | undefined) {
  const normalizedCode = Array.isArray(code) ? code[0] : code
  return normalizedCode ? errorMessages[normalizedCode] : undefined
}

export function getAuthMessage(code: string | string[] | undefined) {
  const normalizedCode = Array.isArray(code) ? code[0] : code
  return normalizedCode ? successMessages[normalizedCode] : undefined
}
