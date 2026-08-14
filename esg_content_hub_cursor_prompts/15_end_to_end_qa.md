# Task 15 — End-to-End QA & MVP Hardening

## 목적

MVP 핵심 시나리오를 처음부터 끝까지 검증하고 배포 가능한 수준으로 안정화합니다.

## Cursor 요청문

현재 구현된 전체 코드를 먼저 분석하고 아래 E2E 시나리오를 기준으로 QA 및 보완 작업을 수행해줘.

### 핵심 시나리오

1. Admin 로그인
2. 삼립 2027 Sustainability Report 프로젝트 진입
3. 소비자 신뢰 확보 Library 조회
4. CT-006 위해상품 판매차단 시스템 선택
5. Previous Version 확인
   - 적용 매장 188개
   - 모의훈련 반기 1회
6. 2027 Update
   - 적용 매장 205개
   - 모의훈련 반기 1회
7. Evidence 업로드
8. AI Change Summary 생성
9. AI Narrative Suggestion 생성
10. Evidence Check 실행
11. Contributor Submit
12. Reviewer Start Review
13. Reviewer Approve
14. 2027 Version = APPROVED
15. Version History에서 2026 → 2027 변경 확인
16. Dashboard KPI 반영
17. Audit Log 확인

### 추가 QA

- 빈 데이터
- API 실패
- AI timeout
- AI malformed output
- Evidence Upload 실패
- 허용되지 않은 상태 전이
- 권한 없는 사용자 접근
- 중복 제출
- 중복 승인
- 새로고침 후 상태 유지
- 긴 Narrative
- Key Facts가 없는 Block

### 코드 품질

- any 최소화
- 중복 코드 정리
- 공통 Error Handler
- Validation 통합
- Loading/Empty/Error 상태
- Server/Client Component 경계 정리
- Environment Variable 검증

### 테스트

가능한 범위에서:
- Unit Test
- Integration Test
- 주요 E2E Test

추가.

### 마지막 검증

- typecheck
- lint
- production build

모두 실행.

### 최종 결과 보고

다음 형식으로 요약해줘.

1. MVP 완료 기능
2. 미완료 기능
3. 알려진 버그
4. 보안상 주의점
5. 성능상 주의점
6. Production 전 필수 조치
7. Phase 2 추천 기능
