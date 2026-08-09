# Atlas — Pilot Checklist

## Empresa e acessos

- [ ] Empresa criada e identificada corretamente.
- [ ] Utilizadores piloto criados.
- [ ] Papéis atribuídos: administrador, projeto, solicitante, revisores/aprovadores, compras e armazém.
- [ ] Memberships ativas apenas para utilizadores autorizados.
- [ ] Responsável do cliente identificado.
- [ ] Canal de suporte acordado.

## Dados operacionais

- [ ] Projetos configurados.
- [ ] Threshold executivo e moeda confirmados.
- [ ] Fornecedores principais importados/criados.
- [ ] Fluxo PR → aprovação → sourcing → PO → receção validado com dados do cliente.

## Segurança

- [ ] Ambiente piloto usa projeto Supabase separado de produção.
- [ ] Ambiente piloto usa projeto Vercel/configuração separada de produção.
- [ ] Secrets disponíveis apenas no runtime apropriado; service/secret key não aparece no browser.
- [ ] RLS Company A / Company B validada.
- [ ] Bucket `atlas-documents` privado.
- [ ] Download cross-tenant recusado.
- [ ] Membership suspensa perde acesso operacional.
- [ ] Reset demo/piloto não aponta para produção.

## Operações

- [ ] Storage funcional com PDF/PNG/JPEG e limite de 10 MB.
- [ ] Notificações in-app funcionais.
- [ ] Auditoria consultável pelo administrador.
- [ ] Backups do plano Supabase escolhido confirmados.
- [ ] Procedimento de restore documentado e testado quando disponível.
- [ ] Demo de 7–10 minutos executada ponta a ponta.
