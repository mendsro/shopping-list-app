# Lista de Compras — Next.js + Supabase

## Como rodar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie um projeto em https://supabase.com e copie a URL e a chave anônima (Project Settings → API).
3. Copie `.env.local.example` para `.env.local` e preencha com esses valores.
4. No SQL Editor do Supabase, execute o conteúdo de `supabase/schema.sql`.
5. Em Authentication → Providers, confirme que "Email" está habilitado (login por e-mail/senha).
6. Rode o projeto:
   ```bash
   npm run dev
   ```
7. Acesse http://localhost:3000 — você será redirecionado para `/login`.

## Estrutura

- `app/` — rotas (App Router): `/login`, `/lists`, `/lists/[id]`.
- `components/` — componentes de UI (`AuthForm`, `Header`, `ListsDashboard`, `ListItems`).
- `lib/supabase.ts` — cliente Supabase para Client Components.
- `lib/supabase-server.ts` — cliente Supabase para Server Components/Actions.
- `lib/types.ts` — tipos do domínio e do schema do banco.
- `middleware.ts` — protege rotas `/lists/*` e redireciona usuários já autenticados para longe de `/login`.
- `supabase/schema.sql` — tabelas `shopping_lists` e `list_items`, com RLS.

## Próximos passos sugeridos

- Compartilhamento de listas entre usuários (tabela `list_members`).
- Categorias de itens (hortifruti, limpeza, etc.) para agrupamento visual.
- Modo offline com sincronização posterior.
