# Beyond-MVP QA Checklist

## Prerequisites
1. Apply SQL in Supabase SQL Editor:
   - `supabase/migrations/20260813000002_project_members.sql`
   - `supabase/migrations/20260813000003_extraction_toc.sql`
2. `npx tsx scripts/apply-beyond-mvp-migrations.ts` (seeds members + reports bucket)
3. `npm run ensure:demo-users`
4. Set `OPENAI_API_KEY` in `.env.local` for TOC extraction
5. `npm run dev`

## 0. Multi-project
- [ ] Settings에서 ADMIN으로 신규 고객사+프로젝트 생성
- [ ] 헤더 Active Project 셀렉터에 새 프로젝트 표시
- [ ] 전환 시 Dashboard/Library 데이터가 프로젝트별로 달라짐
- [ ] CONTRIBUTOR/REVIEWER는 멤버인 프로젝트만 선택 가능

## 1. TOC extraction
- [ ] `/extraction`에서 PDF 업로드 + 목차명 입력
- [ ] OPENAI_API_KEY 없으면 명확한 에러 메시지
- [ ] Job이 REVIEW_REQUIRED로 끝나고 후보가 목차 구간에 해당
- [ ] Candidate Approve 시 active project issue에 블록 생성

## 2. Report draft
- [ ] `/report-draft`에서 블록 목차·본문·Key Facts 미리보기
- [ ] “승인본만” 필터 동작
- [ ] DOCX 다운로드가 열림 (Word/compatible)

## Smoke paths
1. Admin → 프로젝트 생성 → 전환
2. Extraction → TOC 추출 → Approve
3. Annual Update (필요 시) → Report Draft → DOCX
