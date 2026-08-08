const errors: Record<string, string> = {
  invalid_form: 'Verifique os dados submetidos.',
  permission_denied: 'Não possui permissão para executar esta ação.',
  not_found: 'Registo não encontrado.',
  duplicate_tax_number: 'Já existe um fornecedor com este NIF nesta empresa.',
  supplier_blocked: 'O fornecedor está bloqueado e não pode participar nesta compra.',
  invalid_request_status: 'A Purchase Request precisa de estar aprovada.',
  version_conflict: 'O registo foi alterado por outro utilizador. Recarregue a página.',
  quotation_not_editable: 'Esta cotação já não pode ser editada.',
  quotation_items_required: 'A cotação precisa de pelo menos um item antes de ser submetida.',
  justification_required: 'A justificação da seleção é obrigatória.',
  supplier_already_selected: 'Esta Purchase Request já possui um fornecedor selecionado.',
  command_failed: 'Não foi possível concluir a operação.',
}

const notices: Record<string, string> = {
  supplier_created: 'Fornecedor criado.',
  supplier_updated: 'Fornecedor atualizado.',
  supplier_activated: 'Fornecedor ativado.',
  supplier_deactivated: 'Fornecedor desativado.',
  supplier_blocked: 'Fornecedor bloqueado.',
  quotation_created: 'Cotação criada.',
  quotation_updated: 'Cotação atualizada.',
  quotation_submitted: 'Cotação submetida.',
  supplier_selected: 'Fornecedor selecionado formalmente.',
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export function getSourcingError(value?: string | string[]) {
  const key = first(value)
  return key ? errors[key] ?? errors.command_failed : null
}

export function getSourcingNotice(value?: string | string[]) {
  const key = first(value)
  return key ? notices[key] ?? null : null
}
