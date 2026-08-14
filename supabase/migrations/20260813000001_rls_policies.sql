-- Task 14 — MVP RLS policies (company-scoped)
-- Enable RLS and minimum role policies. App also enforces role checks in services.

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.issues enable row level security;
alter table public.content_blocks enable row level security;
alter table public.content_versions enable row level security;
alter table public.key_facts enable row level security;
alter table public.evidences enable row level security;
alter table public.content_evidences enable row level security;
alter table public.reviews enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.extraction_jobs enable row level security;
alter table public.extraction_candidates enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_profile_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Profiles: users see same-company profiles
create policy profiles_select_same_company on public.profiles
for select using (company_id = public.current_profile_company_id());

create policy profiles_update_self on public.profiles
for update using (id = auth.uid());

-- Companies: same company only
create policy companies_select_own on public.companies
for select using (id = public.current_profile_company_id());

-- Projects / issues / blocks: company scope via project.company_id
create policy projects_select_company on public.projects
for select using (company_id = public.current_profile_company_id());

create policy projects_write_admin on public.projects
for all using (
  company_id = public.current_profile_company_id()
  and public.current_profile_role() = 'ADMIN'
);

create policy issues_select_company on public.issues
for select using (
  exists (
    select 1 from public.projects p
    where p.id = issues.project_id
      and p.company_id = public.current_profile_company_id()
  )
);

create policy content_blocks_select on public.content_blocks
for select using (
  exists (
    select 1
    from public.issues i
    join public.projects p on p.id = i.project_id
    where i.id = content_blocks.issue_id
      and p.company_id = public.current_profile_company_id()
      and (
        public.current_profile_role() = 'ADMIN'
        or public.current_profile_role() = 'REVIEWER'
        or content_blocks.owner_user_id = auth.uid()
        or content_blocks.reviewer_user_id = auth.uid()
      )
  )
);

create policy content_blocks_write_owner_admin on public.content_blocks
for all using (
  public.current_profile_role() = 'ADMIN'
  or owner_user_id = auth.uid()
);

create policy content_versions_select on public.content_versions
for select using (
  exists (
    select 1 from public.content_blocks b
    join public.issues i on i.id = b.issue_id
    join public.projects p on p.id = i.project_id
    where b.id = content_versions.content_block_id
      and p.company_id = public.current_profile_company_id()
  )
);

create policy evidences_select_company on public.evidences
for select using (company_id = public.current_profile_company_id());

create policy evidences_insert_authenticated on public.evidences
for insert with check (
  company_id = public.current_profile_company_id()
  and uploaded_by = auth.uid()
);

create policy evidences_delete_admin on public.evidences
for delete using (
  company_id = public.current_profile_company_id()
  and public.current_profile_role() = 'ADMIN'
);

create policy audit_logs_select_admin on public.audit_logs
for select using (public.current_profile_role() = 'ADMIN');

create policy audit_logs_insert_authenticated on public.audit_logs
for insert with check (true);
