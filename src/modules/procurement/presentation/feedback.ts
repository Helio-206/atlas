const errors: Record<string, string> = {
  invalid_form: 'Verifique os dados da solicitação.',
  permission_denied: 'Não possui permissão para executar esta ação.',
  not_found: 'Registo não encontrado.',
  version_conflict: 'O registo foi alterado por outro utilizador. Recarregue a página.',
  not_editable: 'Esta solicitação já não pode ser editada.',
  items_required: 'Adicione pelo menos um item antes de submeter.',
  active_project_required: 'A solicitação precisa de um projeto ativo.',
  self_approval: 'O solicitante não pode aprovar a própria solicitação.',
  invalid_transition: 'Esta transição não é válida para o estado atual.',
  invalid_order_request_status: 'A Purchase Order só pode ser emitida depois da seleção formal do fornecedor.',
  supplier_selection_missing: 'A seleção formal do fornecedor não foi encontrada.',
  selected_quotation_invalid: 'A cotação selecionada já não corresponde à seleção da solicitação.',
  supplier_blocked: 'O fornecedor selecionado está bloqueado.',
  purchase_order_exists: 'Já existe uma Purchase Order ativa para esta solicitação.',
  purchase_order_not_receivable: 'Esta Purchase Order já não aceita receções.',
  over_receipt: 'A quantidade recebida ultrapassa a quantidade restante da Purchase Order.',
  receipt_quantity_required: 'Informe pelo menos uma quantidade de receção superior a zero.',
  document_invalid: 'Selecione um ficheiro válido.',
  document_type: 'Formato de documento não permitido para este registo.',
  document_size: 'O documento deve ter no máximo 10 MB.',
  document_failed: 'Não foi possível anexar o documento.',
  command_failed: 'Não foi possível concluir a operação.',
}

const notices: Record<string, string> = {
  created: 'Solicitação criada.', updated: 'Solicitação atualizada.', item_added: 'Item adicionado.', item_updated: 'Item atualizado.', item_removed: 'Item removido.',
  submitted: 'Solicitação submetida para revisão técnica.', technical_approved: 'Aprovação técnica registada.', financial_approved: 'Aprovação financeira registada.', executive_approved: 'Aprovação executiva registada.',
  returned: 'Solicitação devolvida ao solicitante.', rejected: 'Solicitação rejeitada.', cancelled: 'Solicitação cancelada.', settings_updated: 'Limite de aprovação atualizado.',
  purchase_order_issued: 'Purchase Order emitida.', goods_receipt_recorded: 'Receção de mercadoria registada.', document_uploaded: 'Documento anexado.',
}

function first(value?: string | string[]) { return Array.isArray(value) ? value[0] : value }
export function getProcurementError(value?: string | string[]) { const key=first(value); return key ? errors[key] ?? errors.command_failed : null }
export function getProcurementNotice(value?: string | string[]) { const key=first(value); return key ? notices[key] ?? null : null }
