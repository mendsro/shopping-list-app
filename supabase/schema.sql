-- ============================================================
-- Schema: lista de compras de mercado
-- Execute este script no SQL Editor do seu projeto Supabase
-- ============================================================

-- Extensão necessária para gen_random_uuid()
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabela: shopping_lists
-- Cada linha representa uma lista de compras de um usuário
-- ------------------------------------------------------------
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_lists_user_id_idx
  on public.shopping_lists (user_id);

alter table public.shopping_lists
  add column if not exists budget_goal numeric default 0;

alter table public.shopping_lists
  add column if not exists cashback_percentage numeric not null default 0;

alter table public.shopping_lists
  add column if not exists month_start date not null default date_trunc('month', now())::date;

alter table public.shopping_lists
  add column if not exists status text not null default 'active'
  check (status in ('active', 'archived'));

alter table public.shopping_lists
  add column if not exists is_rollover boolean not null default false;

create table if not exists public.monthly_budget_goals (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_start date not null,
  goal numeric not null default 0 check (goal >= 0),
  purchases_count integer not null default 1 check (purchases_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start)
);

alter table public.monthly_budget_goals
  add column if not exists purchases_count integer not null default 1;

alter table public.monthly_budget_goals enable row level security;

drop policy if exists "Usuários podem ver suas metas mensais" on public.monthly_budget_goals;
create policy "Usuários podem ver suas metas mensais"
  on public.monthly_budget_goals for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar suas metas mensais" on public.monthly_budget_goals;
create policy "Usuários podem criar suas metas mensais"
  on public.monthly_budget_goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar suas metas mensais" on public.monthly_budget_goals;
create policy "Usuários podem atualizar suas metas mensais"
  on public.monthly_budget_goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir suas metas mensais" on public.monthly_budget_goals;
create policy "Usuários podem excluir suas metas mensais"
  on public.monthly_budget_goals for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Tabela: list_items
-- Cada linha representa um item dentro de uma shopping_list
-- ------------------------------------------------------------
create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  quantity numeric not null default 1 check (quantity > 0),
  unit text,
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists list_items_list_id_idx
  on public.list_items (list_id);

alter table public.list_items
  add column if not exists price numeric default 0;

alter table public.list_items
  add column if not exists category text default 'Outros';

-- ------------------------------------------------------------
-- Trigger para manter "updated_at" atualizado em shopping_lists
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_shopping_lists_updated_at on public.shopping_lists;
create trigger trg_shopping_lists_updated_at
  before update on public.shopping_lists
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security (RLS)
-- Cada usuário só pode ver e alterar suas próprias listas/itens
-- ------------------------------------------------------------
alter table public.shopping_lists enable row level security;
alter table public.list_items enable row level security;

-- Políticas: shopping_lists
drop policy if exists "Usuários podem ver suas próprias listas" on public.shopping_lists;
create policy "Usuários podem ver suas próprias listas"
  on public.shopping_lists for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar suas próprias listas" on public.shopping_lists;
create policy "Usuários podem criar suas próprias listas"
  on public.shopping_lists for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem atualizar suas próprias listas" on public.shopping_lists;
create policy "Usuários podem atualizar suas próprias listas"
  on public.shopping_lists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir suas próprias listas" on public.shopping_lists;
create policy "Usuários podem excluir suas próprias listas"
  on public.shopping_lists for delete
  using (auth.uid() = user_id);

-- Políticas: list_items (acesso via propriedade da lista pai)
drop policy if exists "Usuários podem ver itens de suas listas" on public.list_items;
create policy "Usuários podem ver itens de suas listas"
  on public.list_items for select
  using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_items.list_id
        and sl.user_id = auth.uid()
    )
  );

drop policy if exists "Usuários podem inserir itens em suas listas" on public.list_items;
create policy "Usuários podem inserir itens em suas listas"
  on public.list_items for insert
  with check (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_items.list_id
        and sl.user_id = auth.uid()
    )
  );

drop policy if exists "Usuários podem atualizar itens de suas listas" on public.list_items;
create policy "Usuários podem atualizar itens de suas listas"
  on public.list_items for update
  using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_items.list_id
        and sl.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_items.list_id
        and sl.user_id = auth.uid()
    )
  );

drop policy if exists "Usuários podem excluir itens de suas listas" on public.list_items;
create policy "Usuários podem excluir itens de suas listas"
  on public.list_items for delete
  using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_items.list_id
        and sl.user_id = auth.uid()
    )
  );

-- Permissões explícitas para a API REST do Supabase.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.shopping_lists to anon, authenticated;
grant select, insert, update, delete on public.list_items to anon, authenticated;
grant select, insert, update, delete on public.monthly_budget_goals to anon, authenticated;

-- Solicita ao PostgREST a atualização do cache de tabelas.
notify pgrst, 'reload schema';
