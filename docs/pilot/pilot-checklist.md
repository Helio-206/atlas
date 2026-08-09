# Atlas — Pilot Checklist

## 1. Criar Company e acessos

- [ ] Empresa criada e identificada corretamente.
- [ ] Utilizadores piloto criados.
- [ ] Papéis atribuídos: administrador, projeto, solicitante, revisores/aprovadores, compras e armazém.
- [ ] Memberships ativas apenas para utilizadores autorizados.
- [ ] Responsável do cliente identificado.
- [ ] Canal de suporte acordado.

## 2. Configurar operação

- [ ] Projetos configurados.
- [ ] Threshold executivo e moeda confirmados.
- [ ] Fornecedores principais importados/criados.
- [ ] Fluxo PR → aprovação → sourcing → PO → receção validado com dados do cliente.

## 3. Validar antes do go-live

- [ ] Solicitação de teste criada pelo papel solicitante.
- [ ] Aprovação técnica validada pelo aprovador técnico.
- [ ] Aprovação financeira validada pelo aprovador financeiro.
- [ ] Aprovação executiva validada quando o threshold se aplica.
- [ ] Fornecedor e cotação comparados e decisão justificada pelo papel de compras.
- [ ] Ordem de compra emitida com o papel autorizado.
- [ ] Receção parcial/final validada pelo armazém.
- [ ] Utilizador sem a função correta foi bloqueado.
- [ ] Auditoria e notificações confirmadas.

## 4. Go-live e revisão

- [ ] Baseline do processo atual registado.
- [ ] Data de go-live confirmada com o responsável do cliente.
- [ ] Primeiro processo real escolhido.
- [ ] Check-in semanal agendado.
- [ ] Data de revisão de 30 dias agendada.

## 5. Segurança

- [ ] Ambiente piloto usa projeto Supabase separado de produção.
- [ ] Ambiente piloto usa projeto Vercel/configuração separada de produção.
- [ ] Secrets disponíveis apenas no runtime apropriado; service/secret key não aparece no browser.
- [ ] RLS Company A / Company B validada.
- [ ] Bucket `atlas-documents` privado.
- [ ] Download cross-tenant recusado.
- [ ] Membership suspensa perde acesso operacional.
- [ ] Reset demo/piloto não aponta para produção.

## 6. Operações

- [ ] Storage funcional com PDF/PNG/JPEG e limite de 10 MB.
- [ ] Notificações in-app funcionais.
- [ ] Auditoria consultável pelo administrador.
- [ ] Backups do plano Supabase escolhido confirmados.
- [ ] Procedimento de restore documentado e testado quando disponível.
- [ ] Demo de 7–10 minutos executada ponta a ponta.
