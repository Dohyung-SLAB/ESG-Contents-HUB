# Task 05 — Annual Update Workflow

## 목적

현업 담당자가 전년도 콘텐츠를 새로 작성하지 않고 변경된 사실만 입력할 수 있는 Annual Update 화면을 구현합니다.

## Cursor 요청문

현재 Content Library와 Version Model을 기준으로 `/update/[blockId]`를 구현해줘.

### 화면 구조

좌우 비교형 Layout.

#### Left — Previous Year
- Previous Narrative
- Previous Key Facts
- Previous Evidence
- Source Document / Page

#### Right — Current Year Update
- Change Type
- Update Type별 Dynamic Form
- Current Key Facts
- Evidence 영역 placeholder
- Save Draft
- Submit

### Update Type별 Form

다음 Component를 분리해줘.

- `NarrativeUpdateForm`
- `StructureUpdateForm`
- `ActivityUpdateForm`
- `NumericUpdateForm`
- `TargetUpdateForm`
- `CertificationUpdateForm`

Content Block의 `form_schema`가 있는 경우 우선적으로 Dynamic Form Renderer를 사용하도록 설계해줘.

### Status Transition

- 최초 수정 시 `NOT_STARTED → IN_PROGRESS`
- 임시저장: `IN_PROGRESS`
- 제출: `IN_PROGRESS → SUBMITTED`

불법 상태 전이는 Backend에서 차단해줘.

### CT-006 테스트 시나리오

Previous:
- 적용 매장: 188개
- 모의훈련 주기: 반기 1회

2027 Current:
- 적용 매장: 사용자가 숫자 입력
- 모의훈련 주기: 사용자가 선택 또는 텍스트 입력

### Change Type

사용자가:
- 변경 없음
- 수정
- 신규
- 삭제 검토

중 하나를 선택할 수 있게 해줘.

Application value는:
- NO_CHANGE
- MODIFIED
- NEW
- DELETED

### UX 원칙

사용자가 보고서 문안을 새로 작성하는 UI가 아니라, 변경 정보를 입력하는 UI로 구현해줘.

### 완료 조건

- Draft 저장 가능
- 새로고침 후 값 유지
- Status 정상 전이
- 2026 Previous와 2027 Current 비교 가능
- Dynamic Form 정상 렌더링
