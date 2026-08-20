-- Activity photos for report draft (not evidence/proof files).
-- Separate from evidences so Annual Update can attach titled images for the report body.

create table if not exists public.activity_photos (
  id uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references public.content_versions (id) on delete cascade,
  title text not null,
  filename text not null,
  storage_path text not null,
  display_order integer not null default 0,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists activity_photos_content_version_id_idx
  on public.activity_photos (content_version_id);

comment on table public.activity_photos is
  'General activity images with captions for Report Draft (not audit evidence).';
