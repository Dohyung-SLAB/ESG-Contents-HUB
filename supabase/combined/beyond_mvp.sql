-- Beyond-MVP: run in Supabase SQL Editor after init schema.

-- 1) project_members
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  member_role public.user_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_members_project_profile_unique unique (project_id, profile_id)
);

create index if not exists project_members_profile_id_idx
  on public.project_members (profile_id);
create index if not exists project_members_project_id_idx
  on public.project_members (project_id);

drop trigger if exists project_members_set_updated_at on public.project_members;
create trigger project_members_set_updated_at
before update on public.project_members
for each row execute function public.set_updated_at();

insert into public.project_members (project_id, profile_id, member_role)
select p.id, pr.id, pr.role
from public.projects p
cross join public.profiles pr
where p.id in (
  '22222222-2222-4222-8222-222222222201',
  '22222222-2222-4222-8222-222222222202'
)
on conflict (project_id, profile_id) do update
set member_role = excluded.member_role,
    updated_at = timezone('utc', now());

alter table public.project_members enable row level security;

drop policy if exists project_members_select_own on public.project_members;
create policy project_members_select_own
on public.project_members
for select
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = project_members.project_id
      and pm.profile_id = auth.uid()
      and pm.member_role = 'ADMIN'
  )
);

-- 2) toc_section
alter table public.extraction_jobs
  add column if not exists toc_section text;

-- 3) reports bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports',
  'reports',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do nothing;

-- 4) project_invites (consultant pre-registers client emails)
create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  member_role public.user_role not null,
  department text,
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'REVOKED')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  constraint project_invites_client_role_check
    check (member_role in ('CONTRIBUTOR', 'REVIEWER')),
  constraint project_invites_project_email_unique unique (project_id, email)
);

create index if not exists project_invites_email_idx
  on public.project_invites (email);

create index if not exists project_invites_status_idx
  on public.project_invites (status);

drop trigger if exists project_invites_set_updated_at on public.project_invites;
create trigger project_invites_set_updated_at
before update on public.project_invites
for each row execute function public.set_updated_at();

