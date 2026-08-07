const projectErrors: Record<string, string> = {
  invalid_form: 'Verifique os dados do projeto e tente novamente.',
  duplicate_code: 'Já existe um projeto com este código nesta empresa.',
  creation_failed: 'Não foi possível criar o projeto.',
  project_not_found: 'O projeto não existe ou não pertence à empresa atual.',
  version_conflict:
    'O projeto foi alterado entretanto. Atualize a página antes de tentar novamente.',
  not_editable: 'Um projeto fechado não pode ser editado.',
  invalid_transition: 'A transição de estado pedida não é permitida.',
  invalid_command: 'O comando recebido é inválido.',
  command_failed: 'Não foi possível concluir a operação no projeto.',
}

const projectNotices: Record<string, string> = {
  created: 'Projeto criado em estado draft.',
  updated: 'Projeto atualizado.',
  activated: 'Projeto ativado.',
  suspended: 'Projeto suspenso.',
  closed: 'Projeto encerrado.',
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.at(0) : value
}

export function getProjectError(value: string | string[] | undefined) {
  const code = firstValue(value)
  return code ? projectErrors[code] ?? null : null
}

export function getProjectNotice(value: string | string[] | undefined) {
  const code = firstValue(value)
  return code ? projectNotices[code] ?? null : null
}
