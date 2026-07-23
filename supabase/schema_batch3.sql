-- Batch 3: Friends + presence
-- Run this against your Supabase project.

-- === Presence: last_seen timestamp on profiles ===
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- === Friendships ===
-- Directional row: requester → addressee. status = 'pending' | 'accepted' | 'blocked'.
create table if not exists public.friendships (
  id            bigserial primary key,
  requester_id  uuid not null references auth.users(id) on delete cascade,
  addressee_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists friendships_requester_idx on public.friendships (requester_id);

alter table public.friendships enable row level security;

-- Read: either side can read rows involving them.
drop policy if exists "friendships read own" on public.friendships;
create policy "friendships read own"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Insert: only requester can create a request as themselves.
drop policy if exists "friendships send own" on public.friendships;
create policy "friendships send own"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

-- Update: either side can update (accept, reject, block, unfriend).
drop policy if exists "friendships update own" on public.friendships;
create policy "friendships update own"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Delete: either side can delete the row.
drop policy if exists "friendships delete own" on public.friendships;
create policy "friendships delete own"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

grant select, insert, update, delete on public.friendships to authenticated;
grant usage, select on sequence public.friendships_id_seq to authenticated;
grant select, insert, update, delete on public.friendships to service_role;
