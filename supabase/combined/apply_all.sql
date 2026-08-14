-- ESG Content Hub — Task 02 init schema
-- No RLS policies or seed data in this migration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum (
  'ADMIN',
  'CONTRIBUTOR',
  'REVIEWER'
);

create type public.project_status as enum (
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED'
);

create type public.issue_category as enum (
  'ENVIRONMENTAL',
  'SOCIAL',
  'GOVERNANCE'
);

create type public.content_type as enum (
  'POLICY',
  'GOVERNANCE',
  'STRATEGY',
  'RISK_OPPORTUNITY',
  'TARGET',
  'ACTIVITY',
  'PERFORMANCE',
  'PROCESS',
  'CERTIFICATION'
);

create type public.update_type as enum (
  'NARRATIVE',
  'STRUCTURE',
  'ACTIVITY',
  'NUMERIC',
  'TARGET',
  'CERTIFICATION'
);

create type public.content_status as enum (
  'NOT_STARTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'REVISION_REQUESTED',
  'APPROVED',
  'ARCHIVED'
);

create type public.change_type as enum (
  'PENDING',
  'NO_CHANGE',
  'MODIFIED',
  'NEW',
  'DELETED'
);

create type public.key_fact_value_type as enum (
  'TEXT',
  'NUMBER',
  'FREQUENCY',
  'PERCENT',
  'SCORE'
);

create type public.evidence_relationship_type as enum (
  'PRIMARY',
  'SUPPORTING',
  'REFERENCE'
);

create type public.review_action as enum (
  'START_REVIEW',
  'APPROVE',
  'REQUEST_REVISION',
  'COMMENT'
);

create type public.ai_suggestion_type as enum (
  'CHANGE_SUMMARY',
  'NARRATIVE_UPDATE',
  'EVIDENCE_CHECK'
);

create type public.ai_suggestion_status as enum (
  'PENDING',
  'APPLIED',
  'REJECTED',
  'SUPERSEDED'
);

create type public.extraction_job_status as enum (
  'PENDING',
  'PROCESSING',
  'REVIEW_REQUIRED',
  'COMPLETED',
  'FAILED'
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. companies
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_primary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. profiles (links to auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  email text not null,
  full_name text not null,
  role public.user_role not null default 'CONTRIBUTOR',
  department text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_unique unique (email)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  reporting_year integer not null,
  base_year integer,
  status public.project_status not null default 'ACTIVE',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_reporting_year_range
    check (reporting_year between 2000 and 2100),
  constraint projects_base_year_range
    check (base_year is null or base_year between 2000 and 2100)
);

create index projects_company_id_idx on public.projects (company_id);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. issues
-- ---------------------------------------------------------------------------

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  category public.issue_category not null,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index issues_project_id_idx on public.issues (project_id);

create trigger issues_set_updated_at
before update on public.issues
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. content_blocks
-- ---------------------------------------------------------------------------

create table public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  parent_block_id uuid references public.content_blocks (id) on delete set null,
  code text not null,
  section text,
  sub_topic text,
  title text not null,
  content_type public.content_type not null,
  update_type public.update_type not null,
  owner_department text,
  owner_user_id uuid references public.profiles (id) on delete set null,
  reviewer_user_id uuid references public.profiles (id) on delete set null,
  form_schema jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint content_blocks_issue_code_unique unique (issue_id, code)
);

create index content_blocks_issue_id_idx on public.content_blocks (issue_id);
create index content_blocks_parent_block_id_idx on public.content_blocks (parent_block_id);

create trigger content_blocks_set_updated_at
before update on public.content_blocks
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. content_versions
-- ---------------------------------------------------------------------------

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_block_id uuid not null references public.content_blocks (id) on delete cascade,
  reporting_year integer not null,
  previous_version_id uuid references public.content_versions (id) on delete set null,
  narrative text,
  change_type public.change_type not null default 'PENDING',
  change_summary text,
  status public.content_status not null default 'NOT_STARTED',
  source_document text,
  source_page integer,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  constraint content_versions_block_year_unique unique (content_block_id, reporting_year),
  constraint content_versions_reporting_year_range
    check (reporting_year between 2000 and 2100),
  constraint content_versions_source_page_positive
    check (source_page is null or source_page > 0)
);

create index content_versions_content_block_id_idx
  on public.content_versions (content_block_id);
create index content_versions_status_idx
  on public.content_versions (status);

create trigger content_versions_set_updated_at
before update on public.content_versions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. key_facts
-- ---------------------------------------------------------------------------

create table public.key_facts (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references public.content_versions (id) on delete cascade,
  key text not null,
  value_text text,
  value_number numeric,
  unit text,
  value_type public.key_fact_value_type not null,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint key_facts_version_key_unique unique (content_version_id, key)
);

create index key_facts_content_version_id_idx
  on public.key_facts (content_version_id);

create trigger key_facts_set_updated_at
before update on public.key_facts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. evidences
-- ---------------------------------------------------------------------------

create table public.evidences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  filename text not null,
  document_type text,
  reporting_year integer,
  department text,
  storage_path text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint evidences_reporting_year_range
    check (reporting_year is null or reporting_year between 2000 and 2100)
);

create index evidences_company_id_idx on public.evidences (company_id);

create trigger evidences_set_updated_at
before update on public.evidences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. content_evidences (N:N)
-- ---------------------------------------------------------------------------

create table public.content_evidences (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references public.content_versions (id) on delete cascade,
  evidence_id uuid not null references public.evidences (id) on delete cascade,
  relationship_type public.evidence_relationship_type not null default 'SUPPORTING',
  created_at timestamptz not null default timezone('utc', now()),
  constraint content_evidences_version_evidence_unique
    unique (content_version_id, evidence_id)
);

create index content_evidences_content_version_id_idx
  on public.content_evidences (content_version_id);
create index content_evidences_evidence_id_idx
  on public.content_evidences (evidence_id);

-- ---------------------------------------------------------------------------
-- 10. reviews
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references public.content_versions (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  action public.review_action not null,
  comment text,
  created_at timestamptz not null default timezone('utc', now())
);

create index reviews_content_version_id_idx
  on public.reviews (content_version_id);
create index reviews_reviewer_id_idx
  on public.reviews (reviewer_id);

-- ---------------------------------------------------------------------------
-- 11. ai_suggestions
-- ---------------------------------------------------------------------------

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references public.content_versions (id) on delete cascade,
  suggestion_type public.ai_suggestion_type not null,
  status public.ai_suggestion_status not null default 'PENDING',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  applied_at timestamptz
);

create index ai_suggestions_content_version_id_idx
  on public.ai_suggestions (content_version_id);
create index ai_suggestions_status_idx
  on public.ai_suggestions (status);

create trigger ai_suggestions_set_updated_at
before update on public.ai_suggestions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 12. extraction_jobs
-- ---------------------------------------------------------------------------

create table public.extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  status public.extraction_job_status not null default 'PENDING',
  error_message text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index extraction_jobs_project_id_idx
  on public.extraction_jobs (project_id);
create index extraction_jobs_status_idx
  on public.extraction_jobs (status);

create trigger extraction_jobs_set_updated_at
before update on public.extraction_jobs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 13. extraction_candidates
-- ---------------------------------------------------------------------------

create table public.extraction_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.extraction_jobs (id) on delete cascade,
  title text not null,
  section text,
  sub_topic text,
  content_type public.content_type,
  update_type public.update_type,
  narrative text,
  key_facts jsonb not null default '[]'::jsonb,
  source_page integer,
  source_text text,
  confidence numeric(4, 3),
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint extraction_candidates_source_page_positive
    check (source_page is null or source_page > 0),
  constraint extraction_candidates_confidence_range
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index extraction_candidates_job_id_idx
  on public.extraction_candidates (job_id);

create trigger extraction_candidates_set_updated_at
before update on public.extraction_candidates
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 14. audit_logs
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);
create index audit_logs_user_id_idx
  on public.audit_logs (user_id);
create index audit_logs_created_at_idx
  on public.audit_logs (created_at desc);


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


-- Samlip pilot seed (UI/Workflow test data only).
-- Do not treat values as verified facts from the actual sustainability report.
-- No profiles/auth users are seeded (profiles.id references auth.users).

begin;

-- Wipe prior pilot rows (children first) for idempotent re-runs.
delete from public.key_facts
where id in (
  '66666666-6666-4666-8666-666666666601',
  '66666666-6666-4666-8666-666666666602',
  '66666666-6666-4666-8666-666666661801',
  '66666666-6666-4666-8666-666666661802',
  '66666666-6666-4666-8666-666666661803',
  '66666666-6666-4666-8666-666666661804',
  '66666666-6666-4666-8666-666666661805'
);

delete from public.content_versions
where content_block_id in (
  select id from public.content_blocks
  where issue_id = '33333333-3333-4333-8333-333333333301'
)
or id::text like '55555555-5555-4555-8555-%';

delete from public.content_blocks
where issue_id = '33333333-3333-4333-8333-333333333301'
   or id::text like '44444444-4444-4444-8444-%';

delete from public.issues
where id = '33333333-3333-4333-8333-333333333301';

delete from public.projects
where id in (
  '22222222-2222-4222-8222-222222222201',
  '22222222-2222-4222-8222-222222222202'
);

delete from public.companies
where id = '11111111-1111-4111-8111-111111111101';

-- Company
insert into public.companies (id, name, brand_primary)
values (
  '11111111-1111-4111-8111-111111111101',
  '삼립',
  '#1e3a5f'
);

-- Projects
insert into public.projects (
  id, company_id, name, reporting_year, base_year, status
) values
(
  '22222222-2222-4222-8222-222222222201',
  '11111111-1111-4111-8111-111111111101',
  '2026 Sustainability Report',
  2026,
  null,
  'COMPLETED'
),
(
  '22222222-2222-4222-8222-222222222202',
  '11111111-1111-4111-8111-111111111101',
  '2027 Sustainability Report',
  2027,
  2026,
  'ACTIVE'
);

-- Issue (on 2027 project)
insert into public.issues (
  id, project_id, name, category, display_order
) values (
  '33333333-3333-4333-8333-333333333301',
  '22222222-2222-4222-8222-222222222202',
  '소비자 신뢰 확보',
  'SOCIAL',
  1
);

-- Content blocks (18)
insert into public.content_blocks (
  id, issue_id, parent_block_id, code, section, sub_topic, title,
  content_type, update_type, owner_department, owner_user_id, reviewer_user_id,
  form_schema, display_order, is_active
) values
(
  '44444444-4444-4444-8444-444444444401',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-001', '소비자 신뢰 확보', '거버넌스', '소비자중심경영 체계',
  'GOVERNANCE', 'NARRATIVE', null, null, null, '{}'::jsonb, 1, true
),
(
  '44444444-4444-4444-8444-444444444402',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-002', '소비자 신뢰 확보', '조직', '소비자 신뢰 확보 추진 조직',
  'GOVERNANCE', 'STRUCTURE', null, null, null, '{}'::jsonb, 2, true
),
(
  '44444444-4444-4444-8444-444444444403',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-003', '소비자 신뢰 확보', '회의체', 'VOC·CCM 운영 회의체',
  'GOVERNANCE', 'STRUCTURE', null, null, null, '{}'::jsonb, 3, true
),
(
  '44444444-4444-4444-8444-444444444404',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-004', '소비자 신뢰 확보', '위험 및 기회', '소비자 신뢰 관련 위험 및 기회',
  'RISK_OPPORTUNITY', 'NARRATIVE', null, null, null, '{}'::jsonb, 4, true
),
(
  '44444444-4444-4444-8444-444444444405',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-005', '소비자 신뢰 확보', '로드맵', '소비자 신뢰 확보 중장기 로드맵',
  'STRATEGY', 'TARGET', null, null, null, '{}'::jsonb, 5, true
),
(
  '44444444-4444-4444-8444-444444444406',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-006', '소비자 신뢰 확보', '식품안전', '위해상품 판매차단 시스템',
  'ACTIVITY', 'ACTIVITY', null, null, null, '{}'::jsonb, 6, true
),
(
  '44444444-4444-4444-8444-444444444407',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-007', '소비자 신뢰 확보', '식품안전', '사업장 식품안전 점검',
  'PERFORMANCE', 'NUMERIC', null, null, null, '{}'::jsonb, 7, true
),
(
  '44444444-4444-4444-8444-444444444408',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-008', '소비자 신뢰 확보', '식품안전', '식품안전 교육',
  'ACTIVITY', 'ACTIVITY', null, null, null, '{}'::jsonb, 8, true
),
(
  '44444444-4444-4444-8444-444444444409',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-009', '소비자 신뢰 확보', '인증', '식품안전 인증',
  'CERTIFICATION', 'CERTIFICATION', null, null, null, '{}'::jsonb, 9, true
),
(
  '44444444-4444-4444-8444-444444444410',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-010', '소비자 신뢰 확보', '품질경영', '식품안전·품질경영 내재화',
  'ACTIVITY', 'NARRATIVE', null, null, null, '{}'::jsonb, 10, true
),
(
  '44444444-4444-4444-8444-444444444411',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-011', '소비자 신뢰 확보', 'VOC', 'VOC 운영',
  'PROCESS', 'ACTIVITY', null, null, null, '{}'::jsonb, 11, true
),
(
  '44444444-4444-4444-8444-444444444412',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-012', '소비자 신뢰 확보', 'VOC', '소비자분쟁 대응',
  'PROCESS', 'NARRATIVE', null, null, null, '{}'::jsonb, 12, true
),
(
  '44444444-4444-4444-8444-444444444413',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-013', '소비자 신뢰 확보', 'VOC', '통합 VOC 시스템 고도화',
  'ACTIVITY', 'ACTIVITY', null, null, null, '{}'::jsonb, 13, true
),
(
  '44444444-4444-4444-8444-444444444414',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-014', '소비자 신뢰 확보', '제품', '고객 중심 혁신제품',
  'ACTIVITY', 'ACTIVITY', null, null, null, '{}'::jsonb, 14, true
),
(
  '44444444-4444-4444-8444-444444444415',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-015', '소비자 신뢰 확보', '브랜드', '고객 브랜드 경험',
  'ACTIVITY', 'ACTIVITY', null, null, null, '{}'::jsonb, 15, true
),
(
  '44444444-4444-4444-8444-444444444416',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-016', '소비자 신뢰 확보', '모니터링', '식품안전 이슈 모니터링',
  'RISK_OPPORTUNITY', 'NARRATIVE', null, null, null, '{}'::jsonb, 16, true
),
(
  '44444444-4444-4444-8444-444444444417',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-017', '소비자 신뢰 확보', '목표·실적', '클레임 관리 목표 및 실적',
  'TARGET', 'NUMERIC', null, null, null, '{}'::jsonb, 17, true
),
(
  '44444444-4444-4444-8444-444444444418',
  '33333333-3333-4333-8333-333333333301',
  null, 'CT-018', '소비자 신뢰 확보', 'VOC 실적', 'VOC 운영 실적',
  'PERFORMANCE', 'NUMERIC', null, null, null,
  '{
    "fields": [
      {"key": "문의 건수", "label": "문의 건수", "value_type": "NUMBER", "unit": "건"},
      {"key": "불만 건수", "label": "불만 건수", "value_type": "NUMBER", "unit": "건"},
      {"key": "칭찬·제안", "label": "칭찬·제안", "value_type": "NUMBER", "unit": "건"},
      {"key": "처리비율", "label": "처리비율", "value_type": "PERCENT", "unit": "%"},
      {"key": "상담 만족도", "label": "상담 만족도", "value_type": "SCORE", "unit": "점"}
    ]
  }'::jsonb,
  18, true
);

-- 2026 versions (APPROVED) — insert first so 2027 can reference previous_version_id
insert into public.content_versions (
  id, content_block_id, reporting_year, previous_version_id,
  narrative, change_type, change_summary, status,
  source_document, source_page, created_by, updated_by, approved_by, approved_at
) values
('55555555-5555-4555-8555-555555552601', '44444444-4444-4444-8444-444444444401', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552602', '44444444-4444-4444-8444-444444444402', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552603', '44444444-4444-4444-8444-444444444403', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552604', '44444444-4444-4444-8444-444444444404', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552605', '44444444-4444-4444-8444-444444444405', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552606', '44444444-4444-4444-8444-444444444406', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552607', '44444444-4444-4444-8444-444444444407', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552608', '44444444-4444-4444-8444-444444444408', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552609', '44444444-4444-4444-8444-444444444409', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552610', '44444444-4444-4444-8444-444444444410', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552611', '44444444-4444-4444-8444-444444444411', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552612', '44444444-4444-4444-8444-444444444412', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552613', '44444444-4444-4444-8444-444444444413', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552614', '44444444-4444-4444-8444-444444444414', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552615', '44444444-4444-4444-8444-444444444415', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552616', '44444444-4444-4444-8444-444444444416', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552617', '44444444-4444-4444-8444-444444444417', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now())),
('55555555-5555-4555-8555-555555552618', '44444444-4444-4444-8444-444444444418', 2026, null, null, 'NO_CHANGE', null, 'APPROVED', null, null, null, null, null, timezone('utc', now()));

-- 2027 versions (NOT_STARTED, previous = 2026)
insert into public.content_versions (
  id, content_block_id, reporting_year, previous_version_id,
  narrative, change_type, change_summary, status,
  source_document, source_page, created_by, updated_by, approved_by, approved_at
) values
('55555555-5555-4555-8555-555555552701', '44444444-4444-4444-8444-444444444401', 2027, '55555555-5555-4555-8555-555555552601', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552702', '44444444-4444-4444-8444-444444444402', 2027, '55555555-5555-4555-8555-555555552602', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552703', '44444444-4444-4444-8444-444444444403', 2027, '55555555-5555-4555-8555-555555552603', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552704', '44444444-4444-4444-8444-444444444404', 2027, '55555555-5555-4555-8555-555555552604', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552705', '44444444-4444-4444-8444-444444444405', 2027, '55555555-5555-4555-8555-555555552605', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552706', '44444444-4444-4444-8444-444444444406', 2027, '55555555-5555-4555-8555-555555552606', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552707', '44444444-4444-4444-8444-444444444407', 2027, '55555555-5555-4555-8555-555555552607', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552708', '44444444-4444-4444-8444-444444444408', 2027, '55555555-5555-4555-8555-555555552608', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552709', '44444444-4444-4444-8444-444444444409', 2027, '55555555-5555-4555-8555-555555552609', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552710', '44444444-4444-4444-8444-444444444410', 2027, '55555555-5555-4555-8555-555555552610', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552711', '44444444-4444-4444-8444-444444444411', 2027, '55555555-5555-4555-8555-555555552611', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552712', '44444444-4444-4444-8444-444444444412', 2027, '55555555-5555-4555-8555-555555552612', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552713', '44444444-4444-4444-8444-444444444413', 2027, '55555555-5555-4555-8555-555555552613', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552714', '44444444-4444-4444-8444-444444444414', 2027, '55555555-5555-4555-8555-555555552614', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552715', '44444444-4444-4444-8444-444444444415', 2027, '55555555-5555-4555-8555-555555552615', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552716', '44444444-4444-4444-8444-444444444416', 2027, '55555555-5555-4555-8555-555555552616', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552717', '44444444-4444-4444-8444-444444444417', 2027, '55555555-5555-4555-8555-555555552617', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null),
('55555555-5555-4555-8555-555555552718', '44444444-4444-4444-8444-444444444418', 2027, '55555555-5555-4555-8555-555555552618', null, 'PENDING', null, 'NOT_STARTED', null, null, null, null, null, null);

-- CT-006 2026 key facts
insert into public.key_facts (
  id, content_version_id, key, value_text, value_number, unit, value_type, display_order
) values
(
  '66666666-6666-4666-8666-666666666601',
  '55555555-5555-4555-8555-555555552606',
  '적용 매장', null, 188, '개', 'NUMBER', 1
),
(
  '66666666-6666-4666-8666-666666666602',
  '55555555-5555-4555-8555-555555552606',
  '모의훈련 주기', '반기 1회', null, null, 'FREQUENCY', 2
);

-- CT-018 2026 base key facts
insert into public.key_facts (
  id, content_version_id, key, value_text, value_number, unit, value_type, display_order
) values
(
  '66666666-6666-4666-8666-666666661801',
  '55555555-5555-4555-8555-555555552618',
  '문의 건수', null, 11607, '건', 'NUMBER', 1
),
(
  '66666666-6666-4666-8666-666666661802',
  '55555555-5555-4555-8555-555555552618',
  '불만 건수', null, 2185, '건', 'NUMBER', 2
),
(
  '66666666-6666-4666-8666-666666661803',
  '55555555-5555-4555-8555-555555552618',
  '칭찬·제안', null, 445, '건', 'NUMBER', 3
),
(
  '66666666-6666-4666-8666-666666661804',
  '55555555-5555-4555-8555-555555552618',
  '처리비율', '99%', 99, '%', 'PERCENT', 4
),
(
  '66666666-6666-4666-8666-666666661805',
  '55555555-5555-4555-8555-555555552618',
  '상담 만족도', '93점', 93, '점', 'SCORE', 5
);

commit;
