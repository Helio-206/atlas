# Atlas — Backup and Restore

## Princípio

Não afirmar disaster recovery sem testar o mecanismo disponível no plano Supabase efetivamente contratado. A política de retenção e as opções de restore variam por plano/ambiente e devem ser confirmadas no momento de preparar o piloto.

## Antes do piloto

1. Confirmar no projeto Supabase piloto quais backups automáticos/PITR estão disponíveis no plano escolhido.
2. Registar responsável, frequência, retenção e RPO/RTO realmente suportados.
3. Manter Produção e Demo/Piloto em projetos independentes.
4. Confirmar que documentos no Storage fazem parte da estratégia operacional de recuperação adotada; não presumir que um restore PostgreSQL restaura objetos Storage apagados.

## Ensaio de restore

Executar num ambiente descartável, nunca sobre produção:

1. Identificar o backup/restore point disponível.
2. Restaurar/clonar conforme o mecanismo suportado pelo projeto.
3. Verificar autenticação, memberships, projetos, PRs, quotations, POs, receipts, documents metadata e notifications.
4. Verificar separadamente a disponibilidade dos objetos do bucket `atlas-documents`.
5. Executar smoke test das páginas principais.
6. Registar duração, dados recuperados e lacunas observadas.

## Local/Demo

O estado de demonstração é reproduzível por `pnpm demo:reset`; isto **não é backup**. O comando existe apenas para repor dados fictícios e contém guards que recusam produção.

## Evidência mínima antes de declarar DR

- data do último ensaio;
- ambiente onde foi feito;
- restore point usado;
- RPO/RTO observados;
- estado do Storage;
- responsável que validou o resultado.
