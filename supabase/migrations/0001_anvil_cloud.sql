-- ANVIL cloud backend
-- Apply with: Supabase Dashboard → SQL Editor → paste → Run
--   (or: supabase db push, after `supabase link`)

-- ── Workspaces: one row per user, holding their files + chats ──────────────
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null default 'My workspace',
  files jsonb not null default '[]'::jsonb,
  sessions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one workspace per user, so "Save" upserts instead of piling up rows
  constraint workspaces_user_unique unique (user_id)
);

create index if not exists workspaces_user_id_idx
  on public.workspaces (user_id, updated_at desc);
alter table public.workspaces enable row level security;

drop policy if exists "workspaces are per-user" on public.workspaces;
create policy "workspaces are per-user" on public.workspaces
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Shared projects: public read-only links (?p=<slug>) ────────────────────
create table if not exists public.shared_projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null default 'Shared project',
  files jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.shared_projects enable row level security;

drop policy if exists "shared projects are public" on public.shared_projects;
create policy "shared projects are public" on public.shared_projects
  for select using (true);

drop policy if exists "authenticated can share" on public.shared_projects;
create policy "authenticated can share" on public.shared_projects
  for insert
  to authenticated
  with check (auth.uid() = created_by);

-- ── updated_at maintenance ─────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_touch on public.workspaces;
create trigger workspaces_touch
  before update on public.workspaces
  for each row execute function public.touch_updated_at();
