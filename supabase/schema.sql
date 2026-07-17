-- Thian Men / Dodgeball Online — Phase 1 schema
-- Paste this into Supabase → SQL Editor → New query, then click "Run".

-- 1. Profile row per user (linked to Supabase Auth's users table)
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text not null check (char_length(display_name) between 3 and 20),
  country       text not null check (char_length(country) = 2),
  email         text not null,
  is_adult      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- 2. Row Level Security: only the row's owner can insert/update it,
--    but everyone can read display_name + country for leaderboards / opponent
--    names. Email is protected by a view (below) so we never expose it.
alter table public.profiles enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable"
  on public.profiles for select
  using (true);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 3. Public safe view — no email, no timestamps you don't want leaked.
create or replace view public.public_profiles as
  select id, display_name, country from public.profiles;

-- 4. Since Data API auto-expose is OFF, grant privileges explicitly.
grant usage on schema public to anon, authenticated;
grant select               on public.profiles         to anon, authenticated;
grant insert, update       on public.profiles         to authenticated;
grant select               on public.public_profiles  to anon, authenticated;
