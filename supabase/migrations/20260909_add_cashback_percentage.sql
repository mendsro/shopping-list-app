alter table public.shopping_lists
  add column if not exists cashback_percentage numeric not null default 0;