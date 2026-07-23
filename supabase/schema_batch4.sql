-- Batch 4: Party invites
-- Run this against your Supabase project.

create table if not exists public.party_invites (
  id           bigserial primary key,
  from_id      uuid not null references auth.users(id) on delete cascade,
  to_id        uuid not null references auth.users(id) on delete cascade,
  join_code    text not null,
  match_type   text not null default '1v1' check (match_type in ('1v1','2v2','ladder')),
  message      text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '5 minutes'),
  status       text not null default 'pending' check (status in ('pending','accepted','declined'))
);

create index if not exists party_invites_to_status_idx
  on public.party_invites (to_id, status, expires_at);

alter table public.party_invites enable row level security;

-- Sender + receiver can read
drop policy if exists "party_invites read own" on public.party_invites;
create policy "party_invites read own"
  on public.party_invites for select
  using (auth.uid() = from_id or auth.uid() = to_id);

-- Sender can insert only as themselves
drop policy if exists "party_invites send own" on public.party_invites;
create policy "party_invites send own"
  on public.party_invites for insert
  with check (auth.uid() = from_id);

-- Either side can update (mark accepted/declined)
drop policy if exists "party_invites update own" on public.party_invites;
create policy "party_invites update own"
  on public.party_invites for update
  using (auth.uid() = from_id or auth.uid() = to_id);

-- Either side can delete
drop policy if exists "party_invites delete own" on public.party_invites;
create policy "party_invites delete own"
  on public.party_invites for delete
  using (auth.uid() = from_id or auth.uid() = to_id);

grant select, insert, update, delete on public.party_invites to authenticated;
grant usage, select on sequence public.party_invites_id_seq to authenticated;
grant select, insert, update, delete on public.party_invites to service_role;
