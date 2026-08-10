# ATLAS

Plataforma operacional B2B para estruturar processos empresariais com controlo, rastreabilidade e isolamento real entre empresas.

O produto disponível atualmente cobre o ciclo de Procurement:

```text
Solicitação de compra
→ Aprovações
→ Cotações e comparação de fornecedores
→ Seleção documentada
→ Ordem de compra
→ Receções parciais ou finais
→ Auditoria
```

Estado atual: **Sprint 8 — Commercial Launch & First Pilot**.

## Funcionalidades

- autenticação SSR e onboarding de empresas;
- isolamento multi-tenant com PostgreSQL RLS;
- projetos e memberships por função;
- solicitações de compra e aprovação técnica, financeira e executiva;
- fornecedores, cotações completas ou parciais e comparação sem conversão cambial automática;
- seleção transacional de fornecedor com justificação;
- ordens de compra com snapshot comercial;
- receções append-only, parciais e finais, com bloqueio de over-receipt;
- documentos privados com URLs assinadas temporárias;
- notificações in-app e auditoria operacional;
- dados reproduzíveis para demonstração;
- landing pública e gestão comercial mínima de pedidos de demonstração.

## Stack

- Next.js App Router 16
- React 19 e TypeScript strict
- Supabase Auth, PostgreSQL, Storage e RLS
- Zod
- GSAP
- Vitest
- Playwright
- pnpm

## Requisitos locais

- Node.js 22 ou superior;
- pnpm 10.34.5;
- Docker ativo;
- Supabase CLI instalada pelas dependências do projeto.

## Executar localmente

```bash
pnpm install --frozen-lockfile
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase status -o env
```

Crie `.env.local` a partir de `.env.example` e preencha os valores apresentados pelo Supabase local:

```env
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_ATLAS_CONTACT_EMAIL=
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key local>
SUPABASE_SERVICE_ROLE_KEY=<secret/service role key local>
```

Depois execute:

```bash
pnpm dev
```

A aplicação ficará disponível em `http://127.0.0.1:3000`.

## Preparar a demonstração local

O reset demo recusa produção e exige uma instância Supabase local explícita:

```bash
eval "$(pnpm exec supabase status -o env)"

export ATLAS_ENV=local
export ATLAS_DEMO_SUPABASE_URL="$API_URL"
export ATLAS_DEMO_SECRET_KEY="$SECRET_KEY"
export ATLAS_DEMO_PASSWORD='Atlas-Local-Pilot-2026!'

pnpm demo:reset
```

Todas as contas abaixo usam a password definida em `ATLAS_DEMO_PASSWORD`:

| Conta | Função |
|---|---|
| `admin@atlas.demo` | Administrador e staff comercial demo |
| `project.manager@atlas.demo` | Gestor de projeto |
| `requester@atlas.demo` | Solicitante |
| `technical@atlas.demo` | Revisor técnico |
| `finance@atlas.demo` | Aprovador financeiro |
| `director@atlas.demo` | Aprovador executivo |
| `procurement@atlas.demo` | Compras |
| `warehouse@atlas.demo` | Operador de armazém |

Empresa demo: **Construtora Horizonte, Lda.**

O seed inclui três projetos, cinco fornecedores, solicitações em vários estados e o fluxo `SC-2026-0187 → NovaBetão → PO-2026-000042 → receções`.

As contas são exclusivamente para ambientes locais ou de demonstração isolados. Não reutilize esta password em staging ou produção.

## Validação

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm exec supabase db reset
pnpm test:integration
pnpm test:rls
pnpm build
pnpm test:e2e
pnpm exec supabase db lint
pnpm exec supabase db advisors
git diff --check
```

## Organização

```text
src/app/                 rotas e composição Next.js
src/modules/             domínio, aplicação, infraestrutura e apresentação
src/lib/supabase/        clientes browser, servidor e administrativo
supabase/migrations/     evolução reproduzível da base de dados
supabase/tests/          contratos SQL, integração e isolamento RLS
tests/                   jornadas browser e smoke tests
docs/                    operação do piloto, segurança, demo e vendas
```

## Segurança

- o tenant é derivado da sessão e da membership ativa;
- identificadores de empresa enviados pelo browser não são fonte de confiança;
- tabelas operacionais usam RLS e funções privilegiadas têm `search_path` controlado;
- documentos permanecem num bucket privado;
- service role não é incluída no bundle do browser;
- leads comerciais globais exigem atribuição privada de `commercial_admin`; um administrador tenant não recebe esse acesso automaticamente.

Consulte [Pilot Security Review](docs/security/pilot-security-review.md), [Demo Environment](docs/operations/demo-environment.md) e [Pilot Checklist](docs/pilot/pilot-checklist.md).

## Branches

- `develop`: versão integrada e mais recente;
- `sprint8-commercial-launch`: entrega validada da Sprint 8;
- `main`: histórico inicial, preservado temporariamente.

Novas alterações devem partir de `develop`, nunca do scaffold antigo em `main`.
