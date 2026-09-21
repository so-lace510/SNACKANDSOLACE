create table if not exists public.reviews (
  id text primary key,
  name text not null,
  rating integer not null check (rating between 1 and 5),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create policy "Reviews are publicly readable"
  on public.reviews for select
  using (true);

create policy "Reviews are publicly insertable"
  on public.reviews for insert
  with check (true);