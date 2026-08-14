-- Project membership for multi-client consultants and client users.
-- member_role mirrors user_role for project-scoped access.

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

create trigger project_members_set_updated_at
before update on public.project_members
for each row execute function public.set_updated_at();

-- Seed membership for Samlip 2026/2027 when demo profiles exist
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
