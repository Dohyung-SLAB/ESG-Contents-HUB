-- Project invites: consultant pre-registers client emails before they can sign up.

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

create trigger project_invites_set_updated_at
before update on public.project_invites
for each row execute function public.set_updated_at();
