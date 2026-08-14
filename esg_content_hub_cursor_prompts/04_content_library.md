# Task 04 — Content Library

## 목적

ESG Content Hub의 핵심 조회 화면인 Content Library를 구현합니다.

## Cursor 요청문

현재 DB 및 Seed Data 구조를 먼저 확인하고 `/library` 화면을 구현해줘.

### 화면 구조

Desktop 기준 3단 Layout:

#### Left Panel — Issue Tree
- 현재 프로젝트의 Issue 표시
- Section별 Content Block 탐색
- Governance
- Strategy
- Risk Management
- Metrics & Targets

#### Center Panel — Content Block Table

Column:
- ID
- Content Block
- Section
- Content Type
- Owner
- Update Type
- Change Type
- Status
- Last Updated

Filter:
- Section
- Content Type
- Update Type
- Owner
- Change Type
- Status

Search:
- Content Block title
- sub_topic

#### Right Panel — Block Detail

선택한 Block의:
- Title
- Section
- Sub-topic
- Content Type
- Update Type
- Owner
- Reviewer
- Status
- Previous/Current Narrative
- Key Facts
- Evidence
- Source Document
- Source Page
- Version History

를 표시해줘.

### UX

- Table row 클릭 시 우측 Detail Panel 업데이트
- URL query 또는 route state를 활용해 선택 상태 유지
- Badge를 활용해 Status/Change Type 가독성 확보
- Loading / Empty / Error 상태 구현

### 데이터

삼립 2027 프로젝트의 `소비자 신뢰 확보` 18개 Block이 표시되어야 함.

### 이번 단계에서 하지 말 것

- 수정 기능
- AI 기능
- Evidence Upload
- Review Action

### 완료 조건

- 18개 Block 정상 조회
- Filter/Search 정상
- CT-006 선택 시 2026/2027 Version 및 Key Facts 표시
- 빌드/타입체크 통과
