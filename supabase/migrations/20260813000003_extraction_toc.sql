-- TOC section targeting for report extraction jobs + storage path notes.

alter table public.extraction_jobs
  add column if not exists toc_section text;

comment on column public.extraction_jobs.toc_section is
  'User-specified table-of-contents section name to extract from the uploaded report.';

-- Private reports bucket (create via Storage API or dashboard if not exists).
-- Policies assume bucket name "reports".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports',
  'reports',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do nothing;
