# ESG Content Hub — Cursor 개발 요청 순서

이 문서는 Cursor에서 ESG Content Hub MVP를 순차적으로 개발하기 위한 실행 가이드입니다.

## 기본 원칙

- 각 단계는 **이전 단계가 정상 동작한 뒤** 다음 단계로 넘어갑니다.
- Cursor에게 전체 시스템을 한 번에 만들게 하지 않습니다.
- 각 단계마다:
  1. 먼저 현재 코드베이스를 분석하게 합니다.
  2. 변경 계획을 제시하게 합니다.
  3. 실제 코드를 수정하게 합니다.
  4. 빌드·타입체크·린트·핵심 동작을 검증하게 합니다.
  5. 변경 파일과 남은 이슈를 요약하게 합니다.
- MVP 파일럿은 **삼립 / 소비자 신뢰 확보** 이슈를 기준으로 합니다.
- AI 기능은 UI·DB·Workflow가 정상 동작한 뒤 연결합니다.
- AI 결과는 항상 `Suggestion → Human Review → Apply` 구조로 구현합니다.

## 권장 실행 순서

1. `01_project_scaffolding.md`
2. `02_supabase_database.md`
3. `03_samlip_seed_data.md`
4. `04_content_library.md`
5. `05_annual_update.md`
6. `06_evidence_management.md`
7. `07_review_workflow.md`
8. `08_dashboard.md`
9. `09_ai_change_summary.md`
10. `10_ai_narrative_update.md`
11. `11_ai_evidence_check.md`
12. `12_pdf_extraction.md`
13. `13_extraction_review.md`
14. `14_permissions_audit.md`
15. `15_end_to_end_qa.md`

## MVP 완료 기준

아래 시나리오가 처음부터 끝까지 동작하면 MVP 1.0의 핵심이 완성된 것으로 봅니다.

1. Admin 로그인
2. 삼립 2027 Sustainability Report 프로젝트 진입
3. 소비자 신뢰 확보의 Content Library 조회
4. `CT-006 위해상품 판매차단 시스템` 선택
5. 2026년 기존 콘텐츠 및 Key Facts 확인
6. 2027년 변경사항 입력
   - 적용 매장: 188개 → 205개
   - 모의훈련 주기: 반기 1회 유지
7. Evidence 파일 업로드
8. AI Change Summary 생성
9. AI Narrative Update 생성
10. Contributor 제출
11. Reviewer 검토 및 승인
12. 2027 Version 상태가 `APPROVED`로 변경
13. Version History에서 2026 → 2027 변경 이력 확인

## Cursor에게 매 단계 공통으로 요구할 사항

각 프롬프트 마지막에 별도 지시가 없더라도 다음 원칙을 적용합니다.

- 기존 기능을 깨지 않도록 최소 변경합니다.
- TypeScript에서 `any` 사용을 최소화합니다.
- DB 타입과 UI 타입을 일치시킵니다.
- 하드코딩보다 재사용 가능한 컴포넌트와 서비스 레이어를 우선합니다.
- Server/Client Component 경계를 명확히 합니다.
- 보안이 필요한 데이터는 Client에서 직접 처리하지 않습니다.
- 오류 메시지는 사용자에게 이해 가능한 형태로 표시합니다.
- 모든 변경 후 다음을 실행합니다.
  - TypeScript type check
  - lint
  - production build
- 실행하지 못한 검증이 있다면 이유를 명확히 기록합니다.
