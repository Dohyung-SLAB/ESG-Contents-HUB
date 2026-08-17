-- Manual framework tags on extraction candidates and approved content blocks.
-- ESG eval: KCGS / MSCI / DJSI
-- Disclosure: KSSB / GRI / SASB

alter table public.extraction_candidates
  add column if not exists esg_frameworks jsonb not null default '[]'::jsonb;

alter table public.extraction_candidates
  add column if not exists disclosure_frameworks jsonb not null default '[]'::jsonb;

alter table public.content_blocks
  add column if not exists esg_frameworks jsonb not null default '[]'::jsonb;

alter table public.content_blocks
  add column if not exists disclosure_frameworks jsonb not null default '[]'::jsonb;

comment on column public.extraction_candidates.esg_frameworks is
  'Human-selected ESG evaluation frameworks: KCGS, MSCI, DJSI';
comment on column public.extraction_candidates.disclosure_frameworks is
  'Human-selected disclosure frameworks: KSSB, GRI, SASB';
comment on column public.content_blocks.esg_frameworks is
  'Copied from extraction candidate on approve; human-selected';
comment on column public.content_blocks.disclosure_frameworks is
  'Copied from extraction candidate on approve; human-selected';
