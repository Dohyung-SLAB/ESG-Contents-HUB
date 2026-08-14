# Task 07 — Review Workflow

## 목적

Reviewer가 변경된 Content Block만 효율적으로 검토·승인할 수 있는 Workflow를 구현합니다.

## Cursor 요청문

현재 Status Model과 Evidence 기능을 기준으로 `/review` 화면과 Review Workflow를 구현해줘.

### Review Queue

대상:
- `SUBMITTED`
- `UNDER_REVIEW`
- `REVISION_REQUESTED`

Filter:
- Issue
- Owner
- Content Type
- Status
- Change Type

### Review Detail

다음 4개 영역으로 구성.

1. Previous Version
2. Current Proposed Version
3. Evidence
4. Reviewer Actions

### Diff

Narrative와 Key Facts의 전년 대비 차이를 시각적으로 구분해줘.

Key Fact 예:
- 적용 매장: 188 → 205
- 모의훈련: 반기 1회 → 반기 1회

### Review Action

- Start Review
- Approve
- Request Revision
- Comment

### Status

- SUBMITTED → UNDER_REVIEW
- UNDER_REVIEW → APPROVED
- UNDER_REVIEW → REVISION_REQUESTED
- REVISION_REQUESTED → IN_PROGRESS

### Review Log

`reviews` 테이블에 모든 Review Action 저장.

### 승인

Approve 시:
- status = APPROVED
- approved_by
- approved_at

저장.

### 완료 조건

- Contributor 제출 건이 Review Queue에 표시
- Reviewer가 비교 가능
- Revision Request 가능
- Approve 가능
- Review History 표시
