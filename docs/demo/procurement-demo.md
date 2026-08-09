# Atlas — Demo Procurement Journey

Duração alvo: 7–10 minutos.

## História única

Empresa: **Construtora Horizonte, Lda.**
Projeto: **Edifício Aurora**
Necessidade: **Materiais estruturais para laje do piso 7**
Solicitação: **SC-2026-0187**
Valor estimado: **4.850.000 AOA**
Fornecedores comparados: NovaBetão, Lda.; Kwanza Steel; ConstruSul.
Fornecedor selecionado: **NovaBetão, Lda.**
Ordem: **PO-2026-000042**
Estado inicial da demo: **Parcialmente recebida**.

## Contas

As passwords não são versionadas. Use o valor configurado em `ATLAS_DEMO_PASSWORD` no ambiente Demo.

- Solicitante: `requester@atlas.demo`
- Aprovador técnico: `technical@atlas.demo`
- Aprovador financeiro: `finance@atlas.demo`
- Diretor: `director@atlas.demo`
- Compras: `procurement@atlas.demo`
- Armazém: `warehouse@atlas.demo`
- Administrador: `admin@atlas.demo`

## Roteiro

1. **Dashboard — Administrador ou Compras.** Mostrar aprovações pendentes, solicitações em curso, ordens por receber, receções do mês e atividade recente. Explicar que os números são consequência do fluxo operacional, não analytics inventado.
2. **Projeto — Edifício Aurora.** Mostrar que procurement está contextualizado por projeto e empresa.
3. **Solicitação — SC-2026-0187.** Mostrar finalidade, valor, itens e estado. Explicar rastreabilidade desde a necessidade até à receção.
4. **Approval Timeline.** Mostrar submissão, aprovação técnica e financeira com utilizadores e datas.
5. **Supplier Comparison.** Abrir cotações. Comparar NovaBetão, Kwanza Steel e ConstruSul; abrir o PDF anexado da NovaBetão por URL assinada temporária.
6. **Supplier Selection.** Mostrar a decisão formal, justificação e fornecedor escolhido. Explicar que supplier/quotation não podem ser combinados arbitrariamente pelo browser.
7. **Purchase Order — PO-2026-000042.** Mostrar snapshot dos itens, total, documento associado e ligação à solicitação/cotação.
8. **Partial Receipt.** Mostrar progresso: Cimento 80/100, Aço nervurado 50/50, Tinta de proteção 10/30 e a guia de entrega anexada.
9. **Final Receipt.** Para uma execução ao vivo, use uma solicitação nova no E2E/piloto; no dataset pronto, SC-2026-0188 demonstra uma ordem concluída sem destruir o estado parcial da história principal.
10. **Audit Trail — Administrador.** Abrir Auditoria e mostrar quem fez o quê e quando: Created → Submitted → Technical Approved → Financial Approved → Supplier Selected → Purchase Order Issued → Partial Receipt → Final Receipt.

## Antes de cada demonstração

1. Confirmar que está no projeto Supabase Demo, nunca Produção.
2. Definir `ATLAS_ENV=demo`, `ATLAS_DEMO_PROJECT_REF`, `ATLAS_DEMO_CONFIRM_RESET=RESET_DEMO`, URL/secret do ambiente Demo e `ATLAS_DEMO_PASSWORD`.
3. Executar `pnpm demo:reset`.
4. Confirmar login com uma conta demo e abrir `/dashboard`.
5. Não alterar dados da história principal antes da reunião; para ações destrutivas, usar o fluxo criado durante a demo.
