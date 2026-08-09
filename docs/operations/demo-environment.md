# Atlas — Demo Environment

## Separação obrigatória

- **Production**: dados reais. Nunca usar `pnpm demo:reset`.
- **Demo / Staging**: projeto Vercel e projeto Supabase próprios, sem reutilizar a base de produção.
- **Local**: Supabase CLI em loopback.

## Variáveis de reset

### Local

```bash
export ATLAS_ENV=local
export ATLAS_DEMO_SUPABASE_URL=http://127.0.0.1:54321
export ATLAS_DEMO_SECRET_KEY='<local secret key>'
export ATLAS_DEMO_PASSWORD='<demo password>'
pnpm demo:reset
```

O guard exige hostname `127.0.0.1` ou `localhost`.

### Demo hospedado

```bash
export ATLAS_ENV=demo
export ATLAS_DEMO_PROJECT_REF='<demo project ref>'
export ATLAS_DEMO_CONFIRM_RESET=RESET_DEMO
export ATLAS_DEMO_SUPABASE_URL='https://<demo project ref>.supabase.co'
export ATLAS_DEMO_SECRET_KEY='<demo secret key>'
export ATLAS_DEMO_PASSWORD='<demo password>'
pnpm demo:reset
```

O hostname tem de corresponder exatamente ao project ref configurado. `ATLAS_ENV=production` é recusado.

## Vercel

Criar um projeto ou ambiente dedicado ao piloto/demo com:

- `NEXT_PUBLIC_APP_URL` da URL demo;
- `NEXT_PUBLIC_SUPABASE_URL` do projeto Supabase demo;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` do projeto demo.

A secret/service key usada pelo processo de reset não deve ser uma variável `NEXT_PUBLIC_*` nem necessária ao runtime normal da aplicação.

## Reset

`pnpm demo:reset`:

1. confirma o ambiente;
2. cria/normaliza exclusivamente as contas `@atlas.demo`;
3. reconstrói a Construtora Horizonte e entidades demo coerentes;
4. repõe documentos de demonstração no bucket privado;
5. pode ser executado repetidamente sem acumular o fluxo demo.
