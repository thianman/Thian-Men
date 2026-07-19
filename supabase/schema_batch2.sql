-- Batch 2: Daily challenges + login streak
-- Run this against your Supabase project.

-- === Login streak columns on progression ===
alter table public.progression
  add column if not exists last_login_date  date,
  add column if not exists current_streak   int not null default 0,
  add column if not exists longest_streak   int not null default 0,
  add column if not exists last_streak_reward_at timestamptz;

-- === Daily challenges table ===
-- Drop any prior partial attempt so this migration is idempotent.
drop table if exists public.daily_challenges cascade;

create table public.daily_challenges (
  user_id       uuid  not null references auth.users(id) on delete cascade,
  date          date  not null,               -- UTC date the challenge is for
  challenge_id  text  not null,               -- 'win_matches' | 'ko_players' | 'catch_balls' | 'play_as_x'
  target        int   not null,
  progress      int   not null default 0,
  claimed       bool  not null default false,
  reward_xp     int   not null,
  reward_coins  int   not null,
  meta          jsonb,                        -- e.g. { character_id: 'blaze' }
  created_at    timestamptz not null default now(),
  primary key (user_id, date, challenge_id)
);

alter table public.daily_challenges enable row level security;

drop policy if exists "daily_challenges self read" on public.daily_challenges;
create policy "daily_challenges self read"
  on public.daily_challenges for select
  using (auth.uid() = user_id);

drop policy if exists "daily_challenges self write" on public.daily_challenges;
create policy "daily_challenges self write"
  on public.daily_challenges for insert with check (auth.uid() = user_id);

drop policy if exists "daily_challenges self update" on public.daily_challenges;
create policy "daily_challenges self update"
  on public.daily_challenges for update using (auth.uid() = user_id);

-- Service role also needs read/write for server-side reward paths
grant select, insert, update on public.daily_challenges to service_role;

create index if not exists daily_challenges_user_date_idx
  on public.daily_challenges (user_id, date desc);
