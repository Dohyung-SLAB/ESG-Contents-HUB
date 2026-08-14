# MVP End-to-End QA Report

Updated against `esg_content_hub_cursor_prompts` (Tasks 01–15).

## 1. Completed MVP features
- Scaffolding, schema, Samlip seed (SQL + script + pilot store)
- Content Library 3-panel with Section/Content Type/Update Type/Owner/Change Type/Status filters, Last Updated, Source
- Annual Update with Update Type forms + DynamicFormRenderer (`form_schema`), draft/submit transitions
- Evidence drag-drop/file picker, relationship_type, unlink, ADMIN-only delete
- Review queue filters + Dashboard `?status=` deep links, diff, actions, Evidence Check advisory
- Dashboard KPI/action lists
- AI Change Summary / Narrative (Generate·Regenerate·Edit·Apply·Reject) + Evidence Check
- PDF Extraction mock job + candidate approve/merge/split/edit types
- Role switcher + service guards + RLS migration + audit log
- Prompts in `prompts/`

## 2. Incomplete features
- Real Supabase Auth / Storage / live DB repositories (pilot store used for local demo)
- Full OpenAI 4-stage PDF extraction (mocked candidates without API key)
- PDF page highlight viewer
- Automated Playwright E2E suite

## 3. Known bugs / limitations
- Pilot store resets on server restart
- Evidence files store metadata/path only (no binary Storage)
- Evidence Check is heuristic without OCR

## 4. Security notes
- Role checks in services + UI gating (Review/Update/Delete)
- Apply RLS migration before production Supabase use
- Keep service role key server-only

## 5. Performance notes
- Aggregations computed on request; suitable for 18-block pilot

## 6. Must-do before production
1. Wire `.env.local` + run migrations + `npm run seed:samlip`
2. Replace pilot store with Supabase repositories
3. Enable Auth + Storage buckets
4. Add E2E for CT-006 17-step path

## 7. Phase 2 recommendations
- Multi-issue portfolio, OCR citations, PDF highlight, notifications, brand theming

## Manual CT-006 checklist
1. Settings → CONTRIBUTOR
2. Library → CT-006
3. Update → 적용 매장 205, Save Draft, upload evidence, Generate/Apply AI, Submit
4. Settings → REVIEWER → Review → Start → Approve
5. Dashboard KPIs / Settings Audit Log
