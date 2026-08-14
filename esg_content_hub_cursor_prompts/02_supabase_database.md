# Task 02 — Supabase Database Schema

## 목적

ESG Content Hub의 핵심 데이터 모델을 Supabase/PostgreSQL에 구현합니다.

## Cursor 요청문

현재 코드베이스와 기존 migration을 먼저 확인한 후 아래 Supabase Database Schema를 구현해줘.

### 핵심 테이블

다음 테이블을 migration으로 생성해줘.

1. `companies`
2. `profiles`
3. `projects`
4. `issues`
5. `content_blocks`
6. `content_versions`
7. `key_facts`
8. `evidences`
9. `content_evidences`
10. `reviews`
11. `ai_suggestions`
12. `extraction_jobs`
13. `extraction_candidates`
14. `audit_logs`

### 핵심 관계

- Company 1:N Project
- Project 1:N Issue
- Issue 1:N Content Block
- Content Block 1:N Content Version
- Content Version 1:N Key Fact
- Content Version N:N Evidence
- Content Version 1:N Review
- Content Version 1:N AI Suggestion

### 주요 Enum/Check 값

#### User Role
- `ADMIN`
- `CONTRIBUTOR`
- `REVIEWER`

#### Content Type
- `POLICY`
- `GOVERNANCE`
- `STRATEGY`
- `RISK_OPPORTUNITY`
- `TARGET`
- `ACTIVITY`
- `PERFORMANCE`
- `PROCESS`
- `CERTIFICATION`

#### Update Type
- `NARRATIVE`
- `STRUCTURE`
- `ACTIVITY`
- `NUMERIC`
- `TARGET`
- `CERTIFICATION`

#### Content Status
- `NOT_STARTED`
- `IN_PROGRESS`
- `SUBMITTED`
- `UNDER_REVIEW`
- `REVISION_REQUESTED`
- `APPROVED`
- `ARCHIVED`

#### Change Type
- `PENDING`
- `NO_CHANGE`
- `MODIFIED`
- `NEW`
- `DELETED`

### content_blocks 필수 필드

- id
- issue_id
- parent_block_id
- section
- sub_topic
- title
- content_type
- update_type
- owner_department
- owner_user_id
- reviewer_user_id
- form_schema jsonb
- display_order
- is_active
- created_at
- updated_at

### content_versions 필수 필드

- id
- content_block_id
- reporting_year
- previous_version_id
- narrative
- change_type
- change_summary
- status
- source_document
- source_page
- created_by
- updated_by
- approved_by
- created_at
- updated_at
- approved_at

`(content_block_id, reporting_year)`는 unique constraint를 걸어줘.

### key_facts

숫자와 텍스트를 모두 처리할 수 있도록:
- key
- value_text
- value_number
- unit
- value_type
- display_order

를 포함해줘.

### Audit

`audit_logs`에는:
- user_id
- entity_type
- entity_id
- action
- before_data jsonb
- after_data jsonb
- created_at

을 저장해줘.

### TypeScript

DB Schema에 대응하는 Application Type을 `/types`에 생성해줘.

### 이번 단계에서 하지 말 것

- 복잡한 RLS 정책
- Seed Data
- UI 구현
- AI API 연동

### 완료 조건

- migration 파일 생성
- FK/unique/check constraint 정상
- TypeScript Type 생성
- 빌드 통과

마지막에 ERD를 텍스트로 요약해줘.
