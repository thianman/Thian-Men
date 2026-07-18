-- Phase 5: Online ladder global leaderboard
-- Paste into Supabase → SQL Editor → New query, then Run.

create table if not exists public.ladder_records (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete set null,
  display_name  text not null,
  country       text not null check (char_length(country) = 2),
  character     text not null,
  time_ms       int  not null check (time_ms > 30000 and time_ms < 3600000),
  created_at    timestamptz not null default now()
);

create index if not exists idx_ladder_time      on public.ladder_records (time_ms);
create index if not exists idx_ladder_char_time on public.ladder_records (character, time_ms);

alter table public.ladder_records enable row level security;

-- Anyone can read the leaderboard. No client insert policy — only the
-- Worker's service-role key can write, and it validates the time.
drop policy if exists "ladder read all" on public.ladder_records;
create policy "ladder read all"
  on public.ladder_records for select
  using (true);

grant usage  on schema public          to anon, authenticated, service_role;
grant select on public.ladder_records  to anon, authenticated;
-- The Worker writes here with the service-role key (Automatically expose new
-- tables is off, so we grant explicitly).
grant select, insert on public.ladder_records to service_role;
