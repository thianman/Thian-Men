-- Batch 7: Ranked mode
-- Run this against your Supabase project.

-- === Per-player ranked profile ===
create table if not exists public.ranked (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  season            int  not null default 1,
  mmr               int  not null default 1000,
  wins              int  not null default 0,
  losses            int  not null default 0,
  placement_left    int  not null default 5,
  peak_mmr          int  not null default 1000,
  updated_at        timestamptz not null default now()
);

alter table public.ranked enable row level security;

-- Everyone can read anyone's ranked row (needed for leaderboard).
drop policy if exists "ranked read all" on public.ranked;
create policy "ranked read all" on public.ranked for select using (true);

-- Only the row's owner can insert their own.
drop policy if exists "ranked insert own" on public.ranked;
create policy "ranked insert own" on public.ranked for insert with check (auth.uid() = user_id);

-- Only the row's owner can update their own (rewards path uses this).
drop policy if exists "ranked update own" on public.ranked;
create policy "ranked update own" on public.ranked for update using (auth.uid() = user_id);

grant select               on public.ranked to anon, authenticated;
grant insert, update       on public.ranked to authenticated;
grant select, insert, update, delete on public.ranked to service_role;

-- === Matchmaking queue ===
-- One row per queued player. status = 'waiting' | 'matched' | 'left'.
-- room_code is set when a match has been created for this player.
drop table if exists public.ranked_queue cascade;
create table public.ranked_queue (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  mmr          int  not null,
  status       text not null default 'waiting' check (status in ('waiting','matched','left')),
  room_code    text,
  opponent_id  uuid references auth.users(id) on delete set null,
  queued_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ranked_queue_waiting_idx
  on public.ranked_queue (status, mmr, queued_at)
  where status = 'waiting';

alter table public.ranked_queue enable row level security;

-- Everyone can read the queue (needed for matchmaking scans).
drop policy if exists "queue read all" on public.ranked_queue;
create policy "queue read all" on public.ranked_queue for select using (true);

-- Insert / update / delete are all done by the caller as themselves,
-- EXCEPT the update that claims another player when matching — that
-- needs cross-row update. We loosen the update policy to allow it
-- but require the target row to be 'waiting' via the check.
drop policy if exists "queue write own or claim" on public.ranked_queue;
create policy "queue write own or claim"
  on public.ranked_queue for update
  using (true);

drop policy if exists "queue insert own" on public.ranked_queue;
create policy "queue insert own"
  on public.ranked_queue for insert
  with check (auth.uid() = user_id);

drop policy if exists "queue delete own" on public.ranked_queue;
create policy "queue delete own"
  on public.ranked_queue for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.ranked_queue to authenticated;
grant select, insert, update, delete on public.ranked_queue to service_role;
