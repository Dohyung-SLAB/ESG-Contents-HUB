# Task 08 — Dashboard

## 목적

ESG 담당자가 프로젝트 전체 진행상황과 병목을 한눈에 확인하도록 Dashboard를 구현합니다.

## Cursor 요청문

현재 Version/Review/Assignment 데이터를 기반으로 `/dashboard`를 구현해줘.

### KPI Card

- Total Content Blocks
- Not Started
- In Progress
- Submitted
- Under Review
- Revision Requested
- Approved

### Change Status

- Pending
- No Change
- Modified
- New
- Deleted

### Progress

- Contributor Submission Rate
- Review Completion Rate
- Approval Rate

### Action Required

다음 조건을 별도 리스트로 보여줘.

- 미착수
- 제출 대기
- 수정 요청
- Evidence 없음
- Reviewer 미지정

### Section Progress

- Governance
- Strategy
- Risk Management
- Metrics & Targets

별 진행률 표시.

### 구현 원칙

KPI 값은 별도 저장하지 말고 DB에서 집계해줘.

### 완료 조건

- 삼립 18개 Block 기준 KPI 정상 계산
- 클릭 시 해당 Filter가 적용된 Library/Review 화면으로 이동
