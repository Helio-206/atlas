const errors: Record<string, string> = {
  invalid_form: 'Verifique os dados da solicitação.',
  permission_denied: 'Não possui permissão para executar esta ação.',
  not_found: 'Solicitação não encontrada.',
  version_conflict: 'A solicitação foi alterada por outro utilizador. Recarregue a página.',
  not_editable: 'Esta solicitação já não pode ser editada.',
  items_required: 'Adicione pelo menos um item antes de submeter.',
  active_project_required: 'A solicitação precisa de um projeto ativo.',
  self_approval: 'O solicitante não pode aprovar a própria solicitação.',
  invalid_transition: 'Esta transição não é válida para o estado atual.',
  command_failed: 'Não foi possível concluir a operação.',
}

const notices: Record<string, string> = {
  created: 'Solicitação criada.',
  updated: 'Solicitação atualizada.',
  item_added: 'Item adicionado.',
  item_updated: 'Item atualizado.',
  item_removed: 'Item removido.',
  submitted: 'Solicitação submetida para revisão técnica.',
  technical_approved: 'Aprovação técnica registada.',
  financial_approved: 'Aprovação financeira registada.',
  executive_approved: 'Aprovação executiva registada.',
  returned: 'Solicitação devolvida ao solicitante.',
  rejected: 'Solicitação rejeitada.',
  cancelled: 'Solicitação cancelada.',
  settings_updated: 'Limite de aprovação atualizado.',
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export function getProcurementError(value?: string | string[]) {
  const key = first(value)
  return key ? errors[key] ?? errors.command_failed : null
}

export function getProcurementNotice(value?: string | string[]) {
  const key = first(value)
  return key ? notices[key] ?? null : null
}
