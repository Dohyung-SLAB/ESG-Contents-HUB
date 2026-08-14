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
