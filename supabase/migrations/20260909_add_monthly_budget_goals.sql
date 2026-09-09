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