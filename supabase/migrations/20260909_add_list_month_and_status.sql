alter table public.shopping_lists
  add column if not exists month_start date not null default date_trunc('month', now())::date;

alter table public.shopping_lists
  add column if not exists status text not null default 'active'
  check (status in ('active', 'archived'));

alter table public.shopping_lists
  add column if not exists is_rollover boolean not null default false;