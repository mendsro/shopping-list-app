alter table public.shopping_lists
  add column if not exists budget_goal numeric default 0;

alter table public.list_items
  add column if not exists price numeric default 0;

alter table public.list_items
  add column if not exists category text default 'Outros';

alter table public.list_items
  add column if not exists quantity numeric not null default 1;

alter table public.list_items
  add column if not exists is_checked boolean not null default false;
