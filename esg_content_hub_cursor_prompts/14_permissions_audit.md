# Task 14 — Permissions & Audit

## 목적

MVP에 필요한 최소 권한관리와 변경 이력을 구현합니다.

## Cursor 요청문

현재 Auth, DB, Workflow를 기준으로 RBAC와 Audit Log를 구현해줘.

### Role

#### ADMIN
- 프로젝트 전체 접근
- Block 생성/수정
- 담당자 배정
- Evidence 관리
- Review/Approve

#### CONTRIBUTOR
- 자신에게 배정된 Block 조회
- Update
- Evidence Upload
- Submit
- Revision 대응

#### REVIEWER
- Submitted Block 조회
- Evidence 조회
- Comment
- Request Revision
- Approve

### Supabase RLS

최소한:
- 다른 Company 데이터 접근 차단
- Contributor는 자신에게 배정된 Content Block 중심 접근
- Reviewer는 검토 대상 접근
- Admin은 Company 범위 전체 접근

구현해줘.

### Audit Log 대상

다음 Action을 기록해줘.

- CREATE
- UPDATE
- DELETE
- SUBMIT
- REQUEST_REVISION
- APPROVE
- EVIDENCE_UPLOAD
- EVIDENCE_UNLINK
- AI_SUGGESTION_APPLY

### 저장

before_data / after_data jsonb.

### 완료 조건

- Role별 접근 테스트
- Company간 데이터 격리
- 주요 Action Audit Log 기록
