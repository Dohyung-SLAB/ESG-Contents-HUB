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
